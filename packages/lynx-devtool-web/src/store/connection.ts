// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { firstConnectionMade } from '@/api/api';
import { EConnectionState } from '@/types/connection';
import { IDevice, IDeviceInfo, ISessionInfo } from '@/types/device';
import { getAppProcess } from '@/utils';
import LDT_CONST, { getViewMode, isInMobilePageMode } from '@/utils/const';
import debugDriver from '@/utils/debugDriver';
import messageCenter from '@/utils/messageCenter';
import { queryService } from '@/utils/query';
import { sendStatisticsEvent } from '@/utils/statisticsUtils';
import xdbDriver from '@/utils/xdbDriver';
import {
  ECustomDataType,
  ERemoteDebugDriverExternalEvent,
  IClientDescriptor,
  ICustomDataWrapper,
  IRemoteDebugDriverEvent2Payload
} from '@lynx-dev/lynx-devtool-web-components';
import { notification, message } from 'antd';
import { t } from 'i18next';
import create, { getStore } from '../utils/flooks';
import useServer from './server';
import useUser from './user';

export type ConnectionStoreType = ReturnType<typeof connectionStore>;

let delaySum = 0;
let delayCount = 0;
let lastLargeDelayOccurredTime = 0;
let reconnectTimer: string | number | NodeJS.Timeout | null | undefined = null;
let lastWsPath = '';
let lastRoomId = '';
const delaySampleSize = 5;
const KEY_SELECT_DEVICE = 'key_select_device';
const KEY_MULTI_CARD_MODE = 'key_multi_card_mode';
const KEY_KEEP_CARD_OPEN_SESSIONID = 'key_keep_card_open_sessionid';
const KEY_KEEP_CARD_OPEN = 'key_keep_card_open';

// eslint-disable-next-line max-lines-per-function
const connectionStore = (store: any) => ({
  // Selected device
  selectedDevice: JSON.parse(sessionStorage.getItem(KEY_SELECT_DEVICE) || '{"info":{}}') as IDevice,
  deviceList: [...xdbDriver.bindDevices],
  deviceInfoMap: {} as Record<number, IDeviceInfo>,
  connectionState: EConnectionState.Unconnected,
  delay: -1,
  multiCardMode: localStorage.getItem(KEY_MULTI_CARD_MODE) === 'true',
  // The client automatically selects the card session that needs to be focused
  appFocusSession: {} as any,
  keepCardOpen: localStorage.getItem(KEY_KEEP_CARD_OPEN) === 'true',
  keepCardOpenSessionId: parseInt(localStorage.getItem(KEY_KEEP_CARD_OPEN_SESSIONID) ?? '-1', 10),
  cardFilter: queryService.getCardFilter(),

  // Connect DebugRouter
  async openConnection(wsPath: string, roomId: string, isReconnect = false) {
    const { updateDevices, updateSessions, reportPingPongDelay, reconnect } = store() as ConnectionStoreType;
    // Record the currently connected ws url
    lastWsPath = wsPath;
    lastRoomId = roomId;

    // Clear reconnection timer
    reconnectTimer && clearTimeout(reconnectTimer);
    reconnectTimer = null;

    console.log(`start connect ${wsPath}`);

    store({ connectionState: EConnectionState.Connecting });
    const driver = await debugDriver.connect(wsPath, roomId).catch(() => {
      console.log(`debugrouter connect error ${wsPath}`);
      reconnect(wsPath, roomId);
    });
    if (driver) {
      getStore(useServer).updateSchemaPrefix('lynx');
      store({ connectionState: EConnectionState.Connected });
      const handleMessage = (data: any) => messageCenter.handleServerMessage(data);
      const handleClose = () => {
        driver?.off(ERemoteDebugDriverExternalEvent.ClientList, updateDevices);
        driver?.off(ERemoteDebugDriverExternalEvent.SessionList, updateSessions);
        driver?.off(ERemoteDebugDriverExternalEvent.All, handleMessage);
        driver?.off(ERemoteDebugDriverExternalEvent.PingPongDelay, reportPingPongDelay);
        driver?.off(ERemoteDebugDriverExternalEvent.Close, handleClose);
        updateDevices([]);
        reconnect(wsPath, roomId);
        console.log(`debugrouter disconnect ${driver.getSocketServer()}`);
      };
      driver.on(ERemoteDebugDriverExternalEvent.ClientList, updateDevices);
      driver.on(ERemoteDebugDriverExternalEvent.SessionList, updateSessions);
      driver.on(ERemoteDebugDriverExternalEvent.PingPongDelay, reportPingPongDelay);
      driver.on(ERemoteDebugDriverExternalEvent.All, handleMessage);
      driver.on(ERemoteDebugDriverExternalEvent.Close, handleClose);
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

  // Equipment goes online and offline
  updateDevices(clients: IClientDescriptor[]) {
    console.log('updateDevices', clients);
    const {
      deviceList: oldDeviceList,
      selectedDevice,
      deviceInfoMap,
      autoSelectDevice,
      multiCardMode,
      keepCardOpen
    } = store() as ConnectionStoreType;
    // Report some switch status
    sendStatisticsEvent({
      name: 'ldt_devtool_setting',
      categories: {
        multiCardMode: String(multiCardMode),
        keepCardOpen: String(keepCardOpen)
      }
    });

    const currentClientId = selectedDevice.clientId ?? 0;
    let devices = clients.filter((item) => item.type && item.type.toLowerCase() === 'runtime') || [];
    // Isolation between simulator and real device
    if (!isInMobilePageMode()) {
      devices = devices.filter(
        (item) => item.info?.deviceType === 'simulator' && item.info?.deviceModel === `Simulator(${getViewMode()})`
      );
      if (devices.length > 1) {
        devices.forEach((d) => {
          debugDriver.listSessions(d.id);
        });
      }
    } else {
      devices = devices.filter((item) => item.info?.deviceType !== 'simulator');
    }
    devices.forEach((device) => {
      if (!deviceInfoMap[device.id]) {
        deviceInfoMap[device.id] = {
          stopLepusAtEntry: false,
          stopAtEntry: false,
          sessions: []
        };
      }
    });
    // If the selected device is offline, clear the device's session and other information
    if (!devices.find((device) => device.id === currentClientId)) {
      delete deviceInfoMap[currentClientId];
    }
    const newDeviceList: IDevice[] = [];
    // Remove offline devices
    oldDeviceList.forEach((device) => {
      const { clientId, info } = device;
      const index = devices.findIndex((d) => d.id && d.id === clientId);
      if (index >= 0) {
        newDeviceList.push(device);
        devices.splice(index, 1);
      }
    });
    // add new ones
    devices.forEach((item) => {
      const { id: clientId, info } = item;
      const oldDevice = newDeviceList.find(
        (d) =>
          info.appId &&
          info.did &&
          d.info.appId === info.appId &&
          d.info.did === info.did &&
          info.AppProcessName?.includes(':') !== true
      );
      if (oldDevice) {
        oldDevice.clientId = clientId;
        const { deviceModel } = oldDevice.info;
        oldDevice.info = info as IDevice['info'];
        oldDevice.info.deviceModel = deviceModel;
      } else {
        const newDevice = { clientId, info };
        newDeviceList.push(newDevice as IDevice);
      }
      if (isInMobilePageMode() && (info.osType === 'Android' || info.osType === 'iOS')) {
        const appProcessName: any = getAppProcess({ info: info as IDevice['info'] });
        notification.info({
          message: `${info.deviceModel}(${info.App}${appProcessName !== null ? appProcessName : ''}) join!`,
          duration: 3,
          placement: 'topRight'
        });
      }
    });
    autoSelectDevice(newDeviceList);
    store({ deviceList: [...newDeviceList], deviceInfoMap: { ...deviceInfoMap } });
  },

  // add and delete cards
  updateSessions(payload: ICustomDataWrapper<ECustomDataType.SessionList>) {
    console.log('updateSessions', payload);
    const { sender, data } = payload;
    if (!sender) {
      return;
    }
    const {
      deviceInfoMap,
      selectedDevice,
      appFocusSession,
      deviceList,
      setDeviceInfoMap,
      setSelectedDevice,
      setSelectedSession,
      keepCardOpen,
      keepCardOpenSessionId,
      cardFilter,
      setCardDebugMode
    } = store() as ConnectionStoreType;

    // ISessionInfo type definitions are not uniform, temporarily bypassed with as writing
    const sessions = data.sort((a, b) => b.session_id - a.session_id) as ISessionInfo[];
    sessions.forEach((s) => {
      s.url = decodeURIComponent(s.url);
    });
    let deviceInfo = deviceInfoMap[sender];
    if (deviceInfo) {
      // retain the screenshot field in the sessions of the old deviceMap
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
          debugDriver.sendCustomMessage({
            sessionId: oldSession.session_id,
            params: {
              method: 'Lynx.getScreenshot'
            }
          });
        }
      });
    } else {
      // session list messages come earlier than client list
      deviceInfo = {
        stopLepusAtEntry: false,
        stopAtEntry: false,
        sessions
      };
      deviceInfoMap[sender] = deviceInfo;
    }

    // determine the new focus card
    let newSelectedSessionId = -1;
    let shouldKeepCardOpen =
      keepCardOpen &&
      keepCardOpenSessionId > 0 &&
      (!deviceInfo.selectedSession?.session_id || deviceInfo.selectedSession?.session_id === keepCardOpenSessionId);
    if (sessions.length > 0) {
      if (appFocusSession.clientId === sender) {
        const session = sessions.find((item) => item.session_id === appFocusSession.sessionId);
        if (session) {
          newSelectedSessionId = session.session_id;
          shouldKeepCardOpen = false;
          store({ appFocusSession: {} });
        }
      }
      if (newSelectedSessionId === -1) {
        const autoFocusOnLastSession = localStorage.getItem(LDT_CONST.KEY_AUTO_FOCUS_LAST_SESSION) !== 'false';
        // if there are filtering conditions, when automatically selecting cards, the filtered cards should be automatically focused
        const filterSessions = cardFilter ? sessions.filter((s) => s.url.includes(cardFilter)) : sessions;
        const filterSession = filterSessions.find((item) => item.session_id === deviceInfo.selectedSession?.session_id);
        // if no card is selected, or the card is automatically selected and it is not in card debugging mode, or the originally selected card is no longer available, select the first card
        if ((autoFocusOnLastSession && !deviceInfo.isCardDebugMode) || !deviceInfo.selectedSession || !filterSession) {
          newSelectedSessionId = filterSessions[0]?.session_id;
          // when the card in debugging mode is destroyed, exit debugging mode
          // eslint-disable-next-line max-depth
          if (deviceInfo.selectedSession && deviceInfo.isCardDebugMode) {
            setCardDebugMode(sender, false, true, false);
          }
        }
      }
    } else {
      newSelectedSessionId = 0;
      deviceInfo.selectedSession = undefined;
      if (deviceInfo.isCardDebugMode) {
        setCardDebugMode(sender, false, true, false);
      }
    }
    setDeviceInfoMap(deviceInfoMap);
    if (sender === selectedDevice.clientId && newSelectedSessionId !== -1 && !shouldKeepCardOpen) {
      setSelectedSession(newSelectedSessionId);
    }
  },

  // report connection results
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

  // set the cards to be filtered
  setCardFilter(cardFilter: string) {
    const { deviceInfoMap, selectedDevice, setSelectedSession } = store() as ConnectionStoreType;
    const autoFocusOnLastSession = localStorage.getItem(LDT_CONST.KEY_AUTO_FOCUS_LAST_SESSION) !== 'false';
    if (selectedDevice.clientId) {
      const { sessions = [], selectedSession } = deviceInfoMap[selectedDevice.clientId];
      // If there are filtering conditions, when the card is automatically selected, the filtered card should be automatically focused
      const filterSessions = cardFilter ? sessions.filter((s) => s.url.includes(cardFilter)) : sessions;
      // If ​​no card is selected, or the card is automatically selected, or the originally selected card is no longer available, select the first card
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

  // Count the heartbeat data of the front-end-server
  async reportPingPongDelay(payload: IRemoteDebugDriverEvent2Payload[ERemoteDebugDriverExternalEvent.PingPongDelay]) {
    // Update the delay data
    const { updateDelay, selectedDevice } = store();
    updateDelay(payload);

    // Report the buried point
    const devtoolWSUrl = await debugDriver.getRemoteSchema(undefined);
    sendStatisticsEvent({
      name: 'devtool_server_heartbeat',
      metrics: {
        delay: payload
      },
      // Add device parameters for data grouping
      categories: {
        type: selectedDevice.info?.network ?? 'WiFi',
        appId: selectedDevice.info?.appId,
        osType: selectedDevice.info?.osType ?? '',
        devtoolWSUrl
      }
    });
  },

  setDeviceInfoMap(deviceInfoMap: Record<number, IDeviceInfo>) {
    store({ deviceInfoMap: { ...deviceInfoMap } });
  },

  // Select the device
  setSelectedDevice(device: IDevice, session_id?: number) {
    // The device must have an info field, protect it here
    if (!device.info) {
      device.info = {} as any;
    }
    sessionStorage.setItem(KEY_SELECT_DEVICE, JSON.stringify(device));
    if (device.clientId) {
      debugDriver.listSessions(device.clientId);
      if (session_id) {
        store({ appFocusSession: { clientId: device.clientId, sessionId: session_id } });
      }
    }
    store({ selectedDevice: device });
    console.log('selectDevice', device);
  },

  // Select the card
  setSelectedSession(sessionId: number) {
    const { deviceInfoMap, selectedDevice, devtoolSessionWillChange, setDeviceInfoMap, setKeepCardOpenSessionId } =
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
    setKeepCardOpenSessionId(sessionId);
  },

  autoSelectDevice(deviceList: IDevice[]) {
    const { selectedDevice, setSelectedDevice } = store() as ConnectionStoreType;
    let currentDevice: IDevice | undefined;
    // Select the device with debugRouter online first
    if (selectedDevice.clientId) {
      currentDevice = deviceList.find((device) => device.clientId && device.clientId === selectedDevice.clientId);
    }
    // Note that here, do not automatically connect to non-main process devices, because most of the time, the sub-process device is not the device that the user wants to connect to debug, and automatically connecting will interfere with the user
    if (!currentDevice) {
      currentDevice = deviceList.find((device) => device.clientId && debugDriver.isMainProcess(device));
    }
    // If ​​there is no debugRouter online in the device list, look for the xdb online device
    if (!currentDevice) {
      if (selectedDevice.xdbOnline) {
        currentDevice = deviceList.find(
          (device) =>
            device.info?.appId &&
            device.info?.did &&
            device.info.appId === selectedDevice.info?.appId &&
            device.info.did === selectedDevice.info?.did
        );
      }
      if (!currentDevice) {
        currentDevice = deviceList.find((device) => device.xdbOnline);
      }
    }
    // If there is no debugRouter and xdb online device, select an empty device
    if (!currentDevice) {
      currentDevice = {} as IDevice;
    }
    setSelectedDevice({ ...currentDevice });
  },

  async connectRemoteDevice(enable: boolean): Promise<any> {
    const currentTime = Date.now();
    let xdbDuration = 0;
    const { selectedDevice, reportConnect } = store() as ConnectionStoreType;
    try {
      let url = await debugDriver.getRemoteSchema();
      if (url.length === 0) {
        throw new Error(t('platform_not_connected_to_devtool')!);
      }
      if (!enable) {
        url = url.replace('enable', 'disable');
      }

      const debugRouterPromise = debugDriver.getDeviceStatus(selectedDevice, enable);
      await Promise.all([debugRouterPromise]);

      reportConnect(true, '', Date.now() - currentTime, xdbDuration);
      return Promise.resolve();
    } catch (e: any) {
      const message = e instanceof Error ? e.message : e.toString();
      reportConnect(false, message, Date.now() - currentTime, xdbDuration);
      return Promise.reject(e);
    }
  },

  updateDelay(delay: number) {
    const { selectedDevice } = store() as ConnectionStoreType;

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
      if (num > 5000) {
        const { setShowRecommandBanner } = getStore(useUser);
        setShowRecommandBanner(true, t('network_prefix') ?? '');
        // Report when the delay value of two statistics within 3 seconds is greater than 5 seconds
        const timestamp = Date.now();
        if (timestamp - lastLargeDelayOccurredTime < 3000) {
          sendStatisticsEvent({
            name: 'devtool_delay_surge',
            categories: {
              samplePeriod: '3s',
              networkType: selectedDevice.info?.network ?? 'WiFi',
              lynxVersion: selectedDevice.info?.sdkVersion ?? 'unknown',
              debugRouterVersion: selectedDevice.info?.debugRouterVersion ?? 'unknown'
            },
            metrics: {
              delay: num
            }
          });
          lastLargeDelayOccurredTime = 0;
        } else {
          lastLargeDelayOccurredTime = timestamp;
        }
      }
    }
  },

  setTestbenchStarting: (clientId: number, value: boolean) => {
    const { deviceInfoMap } = store() as ConnectionStoreType;
    const deviceInfo = deviceInfoMap[clientId];
    if (deviceInfo) {
      deviceInfo.testbenchStarting = value;
      store({ deviceInfoMap: { ...deviceInfoMap } });
    }
  },
  setTestbenchLoading: (clientId: number, value: boolean) => {
    const { deviceInfoMap } = store() as ConnectionStoreType;
    const deviceInfo = deviceInfoMap[clientId];
    if (deviceInfo) {
      deviceInfo.testbenchLoading = value;
      store({ deviceInfoMap: { ...deviceInfoMap } });
    }
  },
  setTestbenchTimer: (clientId: number, timer: any) => {
    const { deviceInfoMap } = store() as ConnectionStoreType;
    const deviceInfo = deviceInfoMap[clientId];
    if (deviceInfo) {
      deviceInfo.testbenchTimer = timer;
      store({ deviceInfoMap: { ...deviceInfoMap } });
    }
  },
  setStartupTracingDuration: (clientId: number, value: number) => {
    const { deviceInfoMap } = store() as ConnectionStoreType;
    const deviceInfo = deviceInfoMap[clientId];
    if (deviceInfo) {
      deviceInfo.startupTracingDuration = value;
      store({ deviceInfoMap: { ...deviceInfoMap } });
    }
  },
  setTraceStarting: (clientId: number, value: boolean) => {
    const { deviceInfoMap } = store() as ConnectionStoreType;
    const deviceInfo = deviceInfoMap[clientId];
    if (deviceInfo) {
      deviceInfo.traceStarting = value;
      store({ deviceInfoMap: { ...deviceInfoMap } });
    }
  },
  setTraceLoading: (clientId: number, value: boolean) => {
    const { deviceInfoMap } = store() as ConnectionStoreType;
    const deviceInfo = deviceInfoMap[clientId];
    if (deviceInfo) {
      deviceInfo.traceLoading = value;
      store({ deviceInfoMap: { ...deviceInfoMap } });
    }
  },
  setTraceTimer: (clientId: number, timer: any) => {
    const { deviceInfoMap } = store() as ConnectionStoreType;
    const deviceInfo = deviceInfoMap[clientId];
    if (deviceInfo) {
      deviceInfo.traceTimer = timer;
      store({ deviceInfoMap: { ...deviceInfoMap } });
    }
  },
  setMemoryStarting: (clientId: number, value: boolean) => {
    const { deviceInfoMap } = store() as ConnectionStoreType;
    const deviceInfo = deviceInfoMap[clientId];
    if (deviceInfo) {
      deviceInfo.memoryStarting = value;
      store({ deviceInfoMap: { ...deviceInfoMap } });
    }
  },
  async setStopAtEntry(value: boolean) {
    const { selectedDevice } = store() as ConnectionStoreType;
    const { clientId } = selectedDevice;
    if (clientId) {
      await debugDriver.sendCustomMessageAsync({
        type: ECustomDataType.D2RStopAtEntry,
        params: { stop_at_entry: value },
        useParamsAsData: true,
        clientId
      });
      const { deviceInfoMap } = store() as ConnectionStoreType;
      const deviceInfo = deviceInfoMap[clientId];
      if (deviceInfo) {
        deviceInfo.stopAtEntry = value;
        store({ deviceInfoMap: { ...deviceInfoMap } });
      }
    }
  },
  async setStopLepusAtEntry(value: boolean) {
    const { selectedDevice } = store() as ConnectionStoreType;
    const { clientId } = selectedDevice;
    if (clientId) {
      try {
        await debugDriver.sendCustomMessageAsync({
          type: ECustomDataType.D2RStopLepusAtEntry,
          params: { stop_at_entry: value },
          useParamsAsData: true,
          clientId
        });
        const { deviceInfoMap } = store() as ConnectionStoreType;
        const deviceInfo = deviceInfoMap[clientId];
        if (deviceInfo) {
          deviceInfo.stopLepusAtEntry = value;
          store({ deviceInfoMap: { ...deviceInfoMap } });
        }
      } catch (error: any) {
        message.error(error.toString());
      }
    }
  },
  setMultiCardMode(value: boolean) {
    localStorage.setItem(KEY_MULTI_CARD_MODE, String(value));
    sendStatisticsEvent({
      name: 'ldt_devtool_setting',
      categories: {
        multiCardMode: String(value)
      }
    });
    store({ multiCardMode: value });
  },
  setKeepCardOpen(value: boolean) {
    localStorage.setItem(KEY_KEEP_CARD_OPEN, String(value));
    sendStatisticsEvent({
      name: 'ldt_devtool_setting',
      categories: {
        keepCardOpen: String(value)
      }
    });
    store({ keepCardOpen: value });
  },
  setKeepCardOpenSessionId(sessionId: number) {
    localStorage.setItem(KEY_KEEP_CARD_OPEN_SESSIONID, String(sessionId));
    store({ keepCardOpenSessionId: sessionId });
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
  // devtool debugging business logic
  devtoolSessionWillChange(newSession: ISessionInfo | undefined, oldSession?: ISessionInfo) {
    if (newSession?.session_id === oldSession?.session_id) {
      return;
    }
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
      debugDriver.sendCustomMessageAsync({
        sessionId: oldSession.session_id,
        type: ECustomDataType.CDP,
        params: {
          method: 'Debugger.disable'
        }
      });
      debugDriver.sendCustomMessageAsync({
        sessionId: oldSession.session_id,
        type: ECustomDataType.CDP,
        params: {
          method: 'Runtime.disable'
        }
      });
      // send disable to all targets of the old session
      if (oldSession.targets) {
        oldSession.targets.forEach((target) => {
          debugDriver.sendCustomMessageAsync({
            sessionId: oldSession.session_id,
            type: ECustomDataType.CDP,
            params: {
              method: 'Debugger.disable',
              sessionId: target
            }
          });
          debugDriver.sendCustomMessageAsync({
            sessionId: oldSession.session_id,
            type: ECustomDataType.CDP,
            params: {
              method: 'Runtime.disable',
              sessionId: target
            }
          });
        });
      }
      // web only
      if (oldSession.type !== '') {
        debugDriver.sendCustomMessageAsync({
          sessionId: oldSession.session_id,
          type: ECustomDataType.CDP,
          params: {
            method: 'CSS.disable'
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
  async setCardDebugMode(clientId: number, isCardDebugMode: boolean, syncToApp = false, waitRet = true) {
    const { deviceInfoMap } = store() as ConnectionStoreType;
    const deviceInfo = deviceInfoMap[clientId];
    if (deviceInfo) {
      if (!waitRet) {
        deviceInfo.isCardDebugMode = isCardDebugMode;
        store({ deviceInfoMap: { ...deviceInfoMap } });
      }
      if (waitRet) {
        deviceInfo.isCardDebugMode = isCardDebugMode;
        store({ deviceInfoMap: { ...deviceInfoMap } });
      }
    }
  }
});

const useConnection = create(connectionStore);
export default useConnection;
