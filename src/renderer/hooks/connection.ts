// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { EConnectionState } from '@/renderer/types/connection';
import { EDebugDriverClientEventNames, IDevice, IDeviceInfo, ISessionInfo } from '@lynx-js/devtool-plugin-core/renderer';
import {
  ECustomDataType,
  ERemoteDebugDriverExternalEvent,
  IClientDescriptor,
  ICustomDataWrapper,
  IRemoteDebugDriverEvent2Payload
} from '@lynx-js/remote-debug-driver';
import { message } from 'antd';
import { viewMode } from '../utils';
import LDT_CONST from '../utils/const';
import debugDriver from '../utils/debugDriver';
import create from '../utils/flooks';
import { queryService } from '../utils/query';
import { sendStatisticsEvent } from '../utils/statisticsUtils';
import * as switchUtils from '../utils/switchUtils';

export type ConnectionStoreType = ReturnType<typeof connectionStore>;

let delaySum = 0;
let delayCount = 0;
let reconnectTimer: string | number | NodeJS.Timeout | null | undefined = null;
let lastWsPath = '';
let lastRoomId = '';
const delaySampleSize = 5;
const KEY_SELECT_DEVICE = 'key_select_device';

// eslint-disable-next-line max-lines-per-function
const connectionStore = (store: any) => ({
  // selected device
  selectedDevice: JSON.parse(sessionStorage.getItem(KEY_SELECT_DEVICE) || '{}') as IDevice,
  deviceList: [] as IDevice[],
  deviceInfoMap: {} as Record<number, IDeviceInfo>,
  connectionState: EConnectionState.Unconnected,
  delay: -1,
  multiCardMode: false,
  // client automatically selects the card session to focus on
  appFocusSession: {} as any,
  cardFilter: queryService.getCardFilter(),
  driverUnttached: false,
  useVpnIp: localStorage.getItem(LDT_CONST.KEY_USE_VPN_IP) === 'true',

  // connect to DebugRouter
  async openConnection(wsPath = lastWsPath, roomId = lastRoomId, isReconnect = false) {
    const { connectionState, updateDevices, updateSessions, reconnect, reportPingPongDelay, handleMessage } =
      store() as ConnectionStoreType;

    if (connectionState === EConnectionState.Connected && lastRoomId === roomId && lastWsPath === wsPath) {
      return;
    }

    // record the current ws url being connected
    lastWsPath = wsPath;
    lastRoomId = roomId;

    // clear reconnect timer
    reconnectTimer && clearTimeout(reconnectTimer);
    reconnectTimer = null;

    console.log(`start connect ${wsPath}`);
    const start = Date.now();

    store({ connectionState: EConnectionState.Connecting });
    const driver = await debugDriver.connect(wsPath, roomId).catch((e) => {
      console.log(`debugrouter connect error ${wsPath}`, e);
      reconnect(wsPath, roomId);
    });
    if (driver) {
      console.log(`finish connect ${wsPath}, cost: ${Date.now() - start}ms`);
      store({ connectionState: EConnectionState.Connected });
      const handleClose = () => {
        driver?.off(ERemoteDebugDriverExternalEvent.ClientList, updateDevices);
        driver?.off(ERemoteDebugDriverExternalEvent.SessionList, updateSessions);
        driver?.off(ERemoteDebugDriverExternalEvent.Close, handleClose);
        driver?.off(ERemoteDebugDriverExternalEvent.PingPongDelay, reportPingPongDelay);
        driver?.off(ERemoteDebugDriverExternalEvent.All, handleMessage);
        updateDevices([]);
        reconnect(wsPath, roomId);
        console.log(`debugrouter disconnect ${driver.getSocketServer()}`);
      };
      driver.on(ERemoteDebugDriverExternalEvent.ClientList, updateDevices);
      driver.on(ERemoteDebugDriverExternalEvent.SessionList, updateSessions);
      driver.on(ERemoteDebugDriverExternalEvent.Close, handleClose);
      driver.on(ERemoteDebugDriverExternalEvent.PingPongDelay, reportPingPongDelay);
      driver.on(ERemoteDebugDriverExternalEvent.All, handleMessage);
    }
  },

  reconnect(wsPath: string, roomId: string) {
    if (lastWsPath !== wsPath || lastRoomId !== roomId) {
      return;
    }
    console.log(`start reconnect: ${wsPath} ...`);
    store({ connectionState: EConnectionState.Unconnected });
    reconnectTimer = setTimeout(() => {
      const { connectionState, openConnection } = store() as ConnectionStoreType;
      if (connectionState === EConnectionState.Unconnected) {
        openConnection(wsPath, roomId, true);
      }
    }, 3000);
  },

  // device online and offline
  updateDevices(clients: IClientDescriptor[]) {
    console.log('updateDevices', clients);
    const {
      deviceList: oldDeviceList,
      selectedDevice,
      deviceInfoMap,
      autoSelectDevice
    } = store() as ConnectionStoreType;

    const currentClientId = selectedDevice.clientId ?? 0;
    const devices = clients.filter((item) => item.type && item.type.toLowerCase() === 'runtime') || [];
    // when lynx page switches, the previous page sometimes remains, affecting the device currently displayed, here check once session, let ldt select a device with session
    if (viewMode === 'lynx') {
      if (devices.length > 1) {
        devices.forEach((d) => {
          debugDriver.listSessions(d.id);
        });
      }
    }
    devices.forEach((device) => {
      if (!deviceInfoMap[device.id]) {
        deviceInfoMap[device.id] = {
          stopLepusAtEntry: false,
          stopAtEntry: false,
          fetchMTSDebugInfo: false,
          sessions: []
        };
      }
    });
    // if the selected device goes offline, clear the device's session information
    if (!devices.find((device) => device.id === currentClientId)) {
      delete deviceInfoMap[currentClientId];
    }
    const newDeviceList: IDevice[] = [];
    // remove offline devices
    oldDeviceList.forEach((device) => {
      const { clientId } = device;
      const index = devices.findIndex((d) => d.id && d.id === clientId);
      if (index >= 0) {
        // add devices that were online last time and are online this time to newDeviceList
        newDeviceList.push(device);
        // remove devices that are already online from devices
        devices.splice(index, 1);
      }
    });
    // add new devices
    devices.forEach((item) => {
      const { id: clientId, info } = item;
      const newDevice = { clientId, info };
      // LDT start
      // xdbDriver.bindDevice(newDevice as IDevice);
      // LDT end
      newDeviceList.push(newDevice as IDevice);
    });
    store({ deviceList: [...newDeviceList], deviceInfoMap: { ...deviceInfoMap } });
    autoSelectDevice(newDeviceList);
  },

  // card add and delete
  updateSessions(payload: ICustomDataWrapper<ECustomDataType.SessionList>) {
    console.log('updateSessions', payload);
    const { sender, data } = payload;
    if (!sender) {
      return;
    }
    const {
      deviceInfoMap,
      selectedDevice,
      deviceList,
      cardFilter,
      appFocusSession,
      setDeviceInfoMap,
      setSelectedDevice,
      setSelectedSession,
      updateSessionScreenshot
    } = store() as ConnectionStoreType;

    // ISessionInfo's type definition is not unified, temporarily use as writing to bypass
    const sessions = data.sort((a, b) => b.session_id - a.session_id) as ISessionInfo[];
    sessions.forEach((s) => {
      try {
        s.url = decodeURIComponent(s.url);
      } catch (error) {
        console.warn('Failed to decode session URL:', s.url, error);
        // if decoding fails, keep the original URL unchanged
      }
    });
    let deviceInfo = deviceInfoMap[sender];
    if (deviceInfo) {
      // keep the screenshot field in the sessions of the old deviceMap
      deviceInfo.sessions?.forEach((oldSession: ISessionInfo) => {
        if (oldSession.screenshot) {
          const targetSession = sessions.find((s) => s.session_id === oldSession.session_id);
          if (targetSession) {
            targetSession.screenshot = oldSession.screenshot;
            targetSession.engineType = oldSession.engineType;
          }
        }
      });
      deviceInfo.sessions = sessions;
      deviceInfo.sessions?.forEach((oldSession: ISessionInfo) => {
        if (oldSession.type === '' && !oldSession.screenshot) {
          debugDriver
            .sendCustomMessageAsync({
              sessionId: oldSession.session_id,
              params: {
                method: LDT_CONST.MSG_GetScreenshot
              }
            })
            .then((res) => {
              if (res?.params?.data) {
                updateSessionScreenshot(oldSession.session_id, res.params.data);
              }
            })
            .catch((_) => {
              // ignore
            });
        }
      });
      if (viewMode !== 'mobile') {
        // in lynx same-layer rendering mode, multiple device instances will appear, and the device with the session needs to be switched
        if (selectedDevice.clientId !== sender && sessions.length > 0) {
          const d = deviceList.find((d1) => d1.clientId === sender);
          // eslint-disable-next-line max-depth
          if (d && d.info?.deviceType === 'simulator') {
            d && setSelectedDevice({ ...d });
          }
        }
      }
    } else {
      // session list message comes earlier than client list
      deviceInfo = {
        stopLepusAtEntry: false,
        stopAtEntry: false,
        fetchMTSDebugInfo: false,
        sessions
      };
      deviceInfoMap[sender] = deviceInfo;
    }
    // decide the new focused card
    let newSelectedSessionId = -1;
    if (sessions.length > 0) {
      if (appFocusSession.clientId === sender) {
        const session = sessions.find((item) => item.session_id === appFocusSession.sessionId);
        if (session) {
          newSelectedSessionId = session.session_id;
          store({ appFocusSession: {} });
        }
      }
      if (newSelectedSessionId === -1) {
        const autoFocusOnLastSession = localStorage.getItem(LDT_CONST.KEY_AUTO_FOCUS_LAST_SESSION) !== 'false';
        // if there is a filter condition, when automatically selecting cards, the cards after filtering should be automatically focused
        const filterSessions = cardFilter ? sessions.filter((s) => s.url.includes(cardFilter)) : sessions;
        const filterSession = filterSessions.find((item) => item.session_id === deviceInfo.selectedSession?.session_id);
        // if no card is selected, or automatic card selection and not in card debug mode, or the originally selected card is not available, select the first card
        if ((autoFocusOnLastSession && !deviceInfo.isCardDebugMode) || !deviceInfo.selectedSession || !filterSession) {
          newSelectedSessionId = filterSessions[0]?.session_id;
          // TOOD: when the card in debug mode is destroyed, exit debug mode
        }
      }
    } else {
      newSelectedSessionId = 0;
      deviceInfo.selectedSession = undefined;
      // TODO: if (deviceInfo.isCardDebugMode) {
      //   setCardDebugMode(sender, false, true, false);
      // }
    }
    setDeviceInfoMap(deviceInfoMap);
    if (sender === selectedDevice.clientId && newSelectedSessionId !== -1) {
      setSelectedSession(newSelectedSessionId);
    }
  },

  // report connection result
  async reportConnect(success: boolean, message: string, duration: number, xdbDuration: number) {
    const url = await debugDriver.getRemoteSchema(undefined);
    const { selectedDevice } = store() as ConnectionStoreType;
    sendStatisticsEvent({
      name: 'debug_router_connect',
      // add device parameters for data grouping
      categories: {
        type: 'websocket',
        result: `${success}`,
        message,
        duration: duration.toString(),
        xdbDuration: xdbDuration.toString(),
        devtoolWSUrl: url,
        ldtVersion: selectedDevice.info?.ldtVersion ?? '',
        debugRouterVersion: selectedDevice.info?.debugRouterVersion ?? ''
      }
    });
  },

  setDeviceInfoMap(deviceInfoMap: Record<number, IDeviceInfo>) {
    store({ deviceInfoMap: { ...deviceInfoMap } });
  },

  // select device
  setSelectedDevice(device: IDevice, session_id?: number) {
    const { selectedDevice, deviceInfoMap } = store() as ConnectionStoreType;
    // device must have info field, here protect it
    if (!device.info) {
      device.info = {} as any;
    }
    sessionStorage.setItem(KEY_SELECT_DEVICE, JSON.stringify(device));
    // when switching devices, clear the previously selected card of the device, otherwise it will cause the session to not switch
    if (selectedDevice.clientId && deviceInfoMap[selectedDevice.clientId]?.selectedSession) {
      deviceInfoMap[selectedDevice.clientId].selectedSession = undefined;
      store({ deviceInfoMap });
    }
    if (device.clientId) {
      debugDriver.listSessions(device.clientId);
      if (session_id) {
        store({ appFocusSession: { clientId: device.clientId, sessionId: session_id } });
      }
    }
    store({ selectedDevice: device });
    debugDriver.emit(EDebugDriverClientEventNames.ClientChange, { device });
    console.log('selectDevice', device);
  },

  // select card
  setSelectedSession(sessionId: number) {
    const { deviceInfoMap, selectedDevice, devtoolSessionWillChange, setDeviceInfoMap } =
      store() as ConnectionStoreType;
    if (!selectedDevice.clientId) {
      return;
    }
    const device = deviceInfoMap[selectedDevice.clientId];
    if (!device) {
      return;
    }
    const newSession = device.sessions?.find((session) => session.session_id === sessionId);
    const currentSession = device.selectedSession;
    devtoolSessionWillChange(newSession, currentSession);
    device.selectedSession = newSession;
    setDeviceInfoMap(deviceInfoMap);
    debugDriver.emit(EDebugDriverClientEventNames.SessionChange, {
      device: selectedDevice,
      sessionId,
      deviceInfo: device
    });
  },

  setDeviceList(deviceList: IDevice[]) {
    store({ deviceList });
  },

  autoSelectDevice(deviceList: IDevice[]) {
    const { selectedDevice, setSelectedDevice } = store() as ConnectionStoreType;
    let currentDevice: IDevice | undefined;
    if (viewMode === 'mobile' || viewMode === 'lynx') {
      // first select the device that debugRouter is online
      if (selectedDevice.clientId) {
        currentDevice = deviceList.find((device) => device.clientId && device.clientId === selectedDevice.clientId);
      }

      // NOTE: do not automatically connect to non-main process devices, because the sub-process devices are mostly not the devices that users want to connect to debug, and automatically connecting will interfere with users
      if (!currentDevice) {
        currentDevice = deviceList
          .filter((device) => device.info?.deviceType !== 'simulator')
          .find((device) => device.clientId && debugDriver.isMainProcess(device));
      }
    }

    // if there is no device that debugRouter and xdb are online, select an empty device
    if (!currentDevice) {
      currentDevice = {} as IDevice;
    }
    setSelectedDevice({ ...currentDevice });
  },

  updateDelay(delay: number) {
    if (delay.toString() === 'NaN' || delay < 1) {
      store({ delay: -1 });
      return;
    }
    delaySum += delay;
    delayCount += 1;
    if (delayCount >= delaySampleSize) {
      const num = Math.round(delaySum / delaySampleSize);
      store({ delay: num });
      delaySum = 0;
      delayCount = 0;
    }
  },

  async setStopAtEntryLegacy(value: boolean) {
    const { selectedDevice, deviceInfoMap } = store() as ConnectionStoreType;
    const { clientId } = selectedDevice;
    if (clientId === undefined) {
      return;
    }
    try {
      const deviceInfo = deviceInfoMap[clientId];
      if (deviceInfo === undefined) {
        return;
      }
      await debugDriver.sendCustomMessageAsync({
        type: ECustomDataType.D2RStopAtEntry,
        params: { stop_at_entry: value },
        useParamsAsData: true,
        clientId
      });
      deviceInfo.stopAtEntry = value;
      store({ deviceInfoMap: { ...deviceInfoMap } });
    } catch (error: any) {
      console.error(error.toString());
    }
  },
  setStopAtEntry(value: boolean) {
    switchUtils.setStopAtEntry('DEFAULT', value);
    const { setStopAtEntryLegacy } = store();
    setStopAtEntryLegacy(value);
  },
  async setStopLepusAtEntryLegacy(value: boolean) {
    const { selectedDevice, deviceInfoMap } = store() as ConnectionStoreType;
    const { clientId } = selectedDevice;
    if (clientId === undefined) {
      return;
    }
    try {
      const deviceInfo = deviceInfoMap[clientId];
      if (deviceInfo === undefined) {
        return;
      }
      await debugDriver.sendCustomMessageAsync({
        type: ECustomDataType.D2RStopLepusAtEntry,
        params: { stop_at_entry: value },
        useParamsAsData: true,
        clientId
      });
      deviceInfo.stopLepusAtEntry = value;
      store({ deviceInfoMap: { ...deviceInfoMap } });
    } catch (error: any) {
      console.error(error.toString());
    }
  },
  setStopLepusAtEntry(value: boolean) {
    switchUtils.setStopAtEntry('MTS', value);
    const { setStopLepusAtEntryLegacy } = store();
    setStopLepusAtEntryLegacy(value);
  },
  setFetchDebugInfo(type: string, value: boolean) {
    switchUtils.setFetchDebugInfo(type, value);
  },
  updateSessionScreenshot(sessionId: number, data: string) {
    const { deviceInfoMap, selectedDevice } = store() as ConnectionStoreType;
    const sessions = deviceInfoMap[selectedDevice.clientId ?? 0]?.sessions;
    if (sessions) {
      sessions.some((session) => {
        if (session.session_id === sessionId) {
          session.screenshot = data;
          return true;
        } else {
          return false;
        }
      });
      store({ deviceInfoMap: { ...deviceInfoMap } });
    }
  },
  // a11y plugin business logic
  markA11y(clientId: number, sessionId: number) {
    const { deviceInfoMap } = store() as ConnectionStoreType;
    const sessions = deviceInfoMap[clientId]?.sessions;
    const session = sessions?.find((s) => s.session_id === sessionId);
    if (session && session.type === '') {
      window.postMessage(
        {
          type: 'a11y_mark_lynx',
          content: {
            type: 'a11y_start_mark',
            message: session.url
          }
        },
        '*'
      );
    }
  },
  // devtool debug business logic
  devtoolSessionWillChange(newSession: ISessionInfo | undefined, oldSession?: ISessionInfo) {
    if (newSession?.session_id === oldSession?.session_id) {
      return;
    }

    debugDriver.emit(EDebugDriverClientEventNames.SessionWillChange, {
      newSession,
      oldSession
    });

    const { selectedDevice, multiCardMode, markA11y } = store() as ConnectionStoreType;
    if (!selectedDevice.clientId) {
      return;
    }
    // new session
    if (newSession) {
      // notify a11y chrome plugin for lynx session change
      if (newSession.type === '') {
        markA11y(selectedDevice.clientId, newSession.session_id);
      } else {
        // notify WebDevtool for web session change
        debugDriver.sendCustomMessage({
          type: 'WebDevtool',
          useParamsAsData: true,
          params: {
            message: {
              message_id: 1,
              target_session: newSession.session_id,
              type: 'inspect_session'
            }
          }
        });
      }
    }
    // old session
    if (!oldSession) {
      return;
    }
    // Debugger.disable to old session
    if (!multiCardMode || !newSession) {
      // lynx && web
      debugDriver.sendCustomMessage({
        sessionId: oldSession.session_id,
        type: ECustomDataType.CDP,
        params: {
          method: 'Debugger.disable'
        }
      });
      debugDriver.sendCustomMessage({
        sessionId: oldSession.session_id,
        type: ECustomDataType.CDP,
        params: {
          method: 'Runtime.disable'
        }
      });
      // web only
      if (oldSession.type !== '') {
        debugDriver.sendCustomMessage({
          sessionId: oldSession.session_id,
          type: ECustomDataType.CDP,
          params: {
            method: 'CSS.disable'
          }
        });
      } else {
        // lynx only
        debugDriver.sendCustomMessage({
          sessionId: oldSession.session_id,
          type: ECustomDataType.CDP,
          params: {
            method: 'Page.stopScreencast'
          }
        });
      }
    }
  },
  setEngineType(clientId: number, engineType: string, sessionId: number) {
    const { deviceInfoMap } = store() as ConnectionStoreType;
    const deviceInfo = deviceInfoMap[clientId];
    if (deviceInfo) {
      const session = deviceInfo.sessions?.find((s) => s.session_id === sessionId);
      if (session) {
        session.engineType = engineType;
        store({ deviceInfoMap: { ...deviceInfoMap } });
      }
    }
  },

  // set the card to be filtered
  setCardFilter(cardFilter: string) {
    const { deviceInfoMap, selectedDevice, setSelectedSession } = store() as ConnectionStoreType;
    const autoFocusOnLastSession = localStorage.getItem(LDT_CONST.KEY_AUTO_FOCUS_LAST_SESSION) !== 'false';
    if (selectedDevice.clientId) {
      const { sessions = [], selectedSession } = deviceInfoMap[selectedDevice.clientId];
      // if there is a filter condition, when automatically selecting cards, the cards after filtering should be automatically focused
      const filterSessions = cardFilter ? sessions.filter((s) => s.url.includes(cardFilter)) : sessions;
      // if no card is selected, or automatic card selection, or the originally selected card is not available, select the first card
      if (
        autoFocusOnLastSession ||
        !selectedSession ||
        !filterSessions.find((item) => item.session_id === selectedSession?.session_id)
      ) {
        const selectSessionId = filterSessions[0]?.session_id;
        if (selectSessionId) {
          setSelectedSession(filterSessions[0]?.session_id);
        }
      }
    }
    store({ cardFilter });
  },

  // report the heartbeat data of the front-end to the back-end
  async reportPingPongDelay(payload: IRemoteDebugDriverEvent2Payload[ERemoteDebugDriverExternalEvent.PingPongDelay]) {
    // update delay data
    const { updateDelay, selectedDevice } = store();
    updateDelay(payload);

    // report the heartbeat data of the front-end to the back-end
    const devtoolWSUrl = await debugDriver.getRemoteSchema(undefined);
    sendStatisticsEvent({
      name: 'devtool_server_heartbeat',
      metrics: {
        delay: payload
      },
      // add device parameters for data grouping
      categories: {
        type: selectedDevice.info?.network ?? 'WiFi',
        appId: selectedDevice.info?.appId,
        osType: selectedDevice.info?.osType ?? '',
        devtoolWSUrl
      }
    });
  },

  setDriverUnttached(value: boolean) {
    store({ driverUnttached: value });
  },

  setUseVpnIp(useVpnIp: boolean) {
    localStorage.setItem(LDT_CONST.KEY_USE_VPN_IP, String(useVpnIp));
    store({ useVpnIp });
  },

  handleMessage(message: any) {
    const { handleSelectSession, setCardFilter } = store() as ConnectionStoreType;
    if (message) {
      const { event, data } = message;
      const msg = data?.data?.message;
      if (event === LDT_CONST.EVENT_CUSTOMIZED) {
        if (data?.type === LDT_CONST.SYNC_UNATTACHED) {
          store({ driverUnttached: true });
        } else if (data?.type === LDT_CONST.MSG_SELECT_SESSION) {
          handleSelectSession(msg, data?.data?.client_id);
        } else if (data?.type === LDT_CONST.MSG_SET_CARD_FILTER) {
          setCardFilter(msg?.cardFilter);
        }
      }
    }
  },

  handleSelectSession(msg?: any, clientId?: number) {
    const { session_id } = msg;
    const { deviceList, selectedDevice, setSelectedDevice, setSelectedSession } = store() as ConnectionStoreType;
    if (selectedDevice.clientId !== clientId) {
      const device = deviceList.find((d) => d.clientId === clientId);
      if (device) {
        setSelectedDevice(device, session_id);
      }
    } else {
      setSelectedSession(session_id);
    }
    message.info('client switch card successfully');
  }
});

const useConnection = create(connectionStore);
export default useConnection;
