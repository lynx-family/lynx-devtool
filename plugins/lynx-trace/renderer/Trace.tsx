// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  HistoryOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import {
  Button,
  Checkbox,
  Drawer,
  Input,
  InputNumber,
  List,
  message,
  Popconfirm,
  Select,
  Space,
  Tooltip,
  notification,
  Modal
} from "antd";

import { useEffect, useState, useCallback, useRef, useContext } from "react";
import useTrace, { JSProfileType } from "./store/trace";

import * as switchUtils from './utils/switchUtils';
import {
  ILynxTraceProps,
  TraceDeviceInfo,
  TracingGetStartupTracingConfig,
  TracingGetStartupTracingFile,
  TracingMethodEnd,
  TracingMethodStart,
  TracingSetStartupTracingConfig
} from './types/trace';
import { sendIOReadMessage, sendTraceCommand } from './utils/trace';
import React from "react";
import { downloadFile, getFileName } from "./utils/common"
import { ERemoteDebugDriverExternalEvent } from "@lynx-js/remote-debug-driver";
import "./Trace.css"
import { GlobalContext } from "./utils/context";
import { TRACING_PREFIX } from "./utils/const";

const showNotSupportError = () => {
  const href = "https://lynxjs.org/guide/start/integrate-lynx-dev-version.html";
  notification.warning({
    message: (
      <span style={{ fontWeight: 600, fontSize: 16, color: '#222' }}>
        Lynx Dev Version Required
      </span>
    ),
    description: (
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: '4px',
          fontSize: 14,
          lineHeight: '22px',
          color: '#333',
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 500 }}>
            The current app has not integrated the Lynx development version.
          </span>
          <br />
          To access this feature, please follow the integration guide below.
        </div>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          style={{
            color: '#1677ff',
            fontWeight: 500,
            textDecoration: 'underline',
          }}
        >
          Lynx Dev Version Integration Manual
        </a>
      </div>
    ),
    duration: 6,
    style: {
      background: '#fff',
      borderRadius: '10px',
      boxShadow:
        '0 4px 16px rgba(0,0,0,0.08), 0 1.5px 4px rgba(0,0,0,0.06)',
    },
  });
  
}

const showTimeoutError = () => {
  message.error('Timeout! Please make sure the App is in the foreground and try again ');
};

type HistoryFileType = {
  date: Date;
  file: string;
  name: string;
  url: string;
};

const StartupTraceConfig = ({
  selectClientId,
  selectClientDuration,
  setStartupTracingDuration,
  onStartupTracingConfigChanged,
  onGetStartupTracingFile,
}) => {
  const [visible, setVisible] = useState(false);
  const [duration, setDuration] = useState(-1);
  const [saving, setSaving] = useState(false);

  const handleOpen = () => {
    setDuration(selectClientDuration ?? -1);
    setVisible(true);
  };

  const handleSetDuration = async () => {
    if (duration <= 0 || isNaN(duration)) {
      message.error('Please set a valid duration (> 0)');
      return;
    }
    setSaving(true);
    if (selectClientId) {
      await setStartupTracingDuration(selectClientId, duration);
    }
    onStartupTracingConfigChanged(duration);
    setSaving(false);
    setVisible(false);
  };

  const handleLoadTrace = () => {
    onGetStartupTracingFile();
    setVisible(false);
  };

  return (
    <>
      <Button
        type="primary"
        style={{ marginLeft: 3, borderRadius: 4 }}
        onClick={handleOpen}
      >
        Startup Trace
      </Button>
      <Modal
        open={visible}
        title="Startup Trace Steps"
        onCancel={() => setVisible(false)}
        footer={null}
        width={420}
        destroyOnClose
      >
        {/* Step 1 */}
        <div style={{ marginBottom: 20 }}>
          <strong>Step 1: Set Trace Duration</strong>
          <div style={{ marginTop: 8, marginBottom: 6 }}>
            <Tooltip title="Valid if duration > 0. Press Enter or Confirm to save.">
              <InputNumber
                min={1}
                max={9999}
                step={1}
                style={{ width: 180 }}
                value={duration}
                onChange={val => setDuration(Number(val))}
                onPressEnter={handleSetDuration}
                addonAfter="s"
                autoFocus
              />
            </Tooltip>
            <Button
              type="primary"
              loading={saving}
              style={{ marginLeft: 10 }}
              onClick={handleSetDuration}
            >
              Confirm
            </Button>
          </div>
          <div style={{ color: '#888', fontSize: 13 }}>
            {duration > 0 ? (
              <span style={{ color: '#52c41a' }}>✔ Duration set to <b>{duration}s</b></span>
            ) : (
              <span>Please set a valid duration to proceed.</span>
            )}
          </div>
        </div>
        {/* Step 2 */}
        <div style={{ marginBottom: 20}}>
          <strong>Step 2: Manually Cold Start the App</strong>
          <div style={{ color: '#888', fontSize: 13, marginTop: 6 }}>
            Please close and fully restart your app to record the startup trace data.
          </div>
        </div>
        {/* Step 3 */}
        <div>
          <strong>Step 3: Load Trace</strong>
          <div style={{ marginTop: 8 }}>
            <Button
              type="primary"
              onClick={handleLoadTrace}
            >
              Load Trace
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};


const TraceView: React.FC<ILynxTraceProps> = (props: ILynxTraceProps) => {
  const {
    categories: traceCategories,
    setCategories,
    jsProfileType,
    setJSProfileType,
    traceUrl,
    setTraceUrl,
    setFileName,
    setTraceStarting,
    setTraceLoading,
    setTraceTimer,
    setStartupTracingDuration,
    deviceMap
  } = useTrace();

  const deviceMapRef = useRef(deviceMap);

  useEffect(() => {
    deviceMapRef.current = deviceMap;
  }, [deviceMap]);

  const { debugDriver, asyncBridge} = useContext(GlobalContext);

  const [open, setOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [historyFiles, setHistoryFiles] = useState<HistoryFileType[]>([]);
  const getStartupTracingConfig = async () => {
    const data = {
      method: TracingGetStartupTracingConfig,
      sessionId: -1,
      params: {},
    };

    const configData = await debugDriver.sendCustomMessageAsync({
      params: data,
    });
    const config = JSON.parse(configData?.result?.config ?? "{}");
    return config;
  };

  const getStartupTracingFile = async () => {
    const method = TracingGetStartupTracingFile;
    const params = {
      method,
      sessionId: -1,
    };
    try {
      const res = await debugDriver.sendCustomMessageAsync({ params });
      return res;
    } catch (error: any) {
      return {};
    }
  };

  const onGetStartupTracingFile = async () => {
    try {
      const res = await getStartupTracingFile();
      if (res.error) {
        if (res.error?.message?.indexOf("Startup Tracing is running") >= 0) {
          message.error("Startup tracing is in progress, please try again later");
        } else if (
          res.error?.message?.indexOf("Failed to get startup tracing file") >= 0
        ) {
          message.error("Startup tracing is not enabled, cannot pull trace data");
        }
        return;
      } else {
        message.success("Startup tracing data load succeeded");
      }
    } catch (error: any) {
      console.warn(`getStartupTracingFile faile: ${error.message}`);
    }
  };

  const onStartupTracingConfigChanged = async (duration: number) => {
    const method = TracingSetStartupTracingConfig;
    const params = {
      method,
      sessionId: -1,
      params: {
        config: JSON.stringify({
          startup_duration: duration,
          enable_systrace: true,
        }),
      },
    };
    try {
      await debugDriver.sendCustomMessageAsync({ params });
      const config = await getStartupTracingConfig();
      if (
        config.startup_duration === undefined ||
        config.startup_duration <= 0
      ) {
        message.error("Failed to set startup tracing configuration");
      } else {
        message.success("Startup tracing configuration set successfully, the next cold start of the App will take effect");
      }
    } catch (e: any) {
      message.error("Failed to set startup tracing configuration");
      console.error(`onStartupTracingConfigChanged: ${e.message}`);
    }
  };

  const updateHistoryFile = async () => {
    try {
      const response = await asyncBridge.getFileList();
      if (response.code === 0) {
        const historyFiles = (response.data ?? []) as HistoryFileType[];
        setHistoryFiles(historyFiles);
      }
    } catch (error) {
      setHistoryFiles([]);
    }
  };
  const deleteHistoryFile = async (fileName: string) => {
    try {
      await asyncBridge.deleteLocalFile(fileName);
    } catch (error) { }
  };

  const renameHistoryFile = async (oldName: string, newName: string) => {
    try {
      await asyncBridge.renameLocalFile(oldName, newName);
    } catch (error) { }
  };

  const showDrawer = () => {
    updateHistoryFile();
    setOpen(true);
  };

  const closeDrawer = () => {
    setOpen(false);
  };

  const handleSelectedChange = (value: any) => {
    setSelectedItems(value);
  };

  const handleSelectedAll = () => {
    if (historyFiles.length === selectedItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(historyFiles.map((item: any) => item.file));
    }
  };

  const readStreamDataPromise = async (stream: number): Promise<Array<Buffer>> => {
    const dataChunks: Array<Buffer> = [];
    try {
      let hasEnd = false;
      while (!hasEnd) {
        const message = await sendIOReadMessage(debugDriver, stream);
        if (!message.result) {
          return Promise.reject(new Error('no data'));
        }
        const chunk = Buffer.from(message?.result?.data ?? '', 'base64');
        dataChunks.push(chunk);
        hasEnd = message.result.eof;
      }
      return Promise.resolve(dataChunks);
    } catch (e) {
      return Promise.reject(e);
    }
  };

  const handleTraceComplete = async (msg: Record<string, any>, clientId: number, currentDeviceMap: Record<number, TraceDeviceInfo>) => {
    const runningClient = currentDeviceMap[clientId];
    console.log('has receive TraceComplete: ' + JSON.stringify(runningClient));
    if (runningClient?.traceStarting || runningClient?.traceLoading || msg?.params?.isStartupTracing) {
      const stream = msg?.params?.stream;
      console.log('start read trace data:');
      const dataChunks = await readStreamDataPromise(stream);
      const fileName = `${getFileName(props.info)}.pftrace`.replace(/[\\\/:\*\?"<>\|]/g, '-');
      asyncBridge
        .uploadFileToLocal(dataChunks, fileName)
        .then((res) => {
          const url = res?.url;
          console.log('trace url:' + url);
          if (url) {
            setTraceUrl(url);
            setFileName(res?.file);
            setTraceLoading(clientId, false);
            const timer = currentDeviceMap[props.clientId ?? 0]?.traceTimer;
            if (timer) {
              clearTimeout(timer);
              setTraceTimer(clientId, null);
            }
          } else {
            setTraceLoading(clientId, false);
          }
        })
        .catch((e) => {
          console.error(`trace upload failed: ${e}`);
        });
    }
  };

  const handleDriverMessage = useCallback((msg?: any) => {
    const currentDeviceMap = deviceMapRef.current;
    const { event, data } = msg ?? {};
    if (event !== 'Customized' || !data) {
      return;
    }
    let { message } = data?.data ?? {};
    if (!message) {
      return;
    }
    if (typeof message === 'string') {
      try {
        message = JSON.parse(message);
      } catch (e) {
        console.log('testbench parse message error:', e);
        return;
      }
    }

    const clientId = data?.data?.client_id;
    const method = message?.method;
    if (method === 'Tracing.tracingComplete') {
      handleTraceComplete(message, clientId, currentDeviceMap);
    }
  }, []);

  useEffect(() => {
    debugDriver.on(ERemoteDebugDriverExternalEvent.All, handleDriverMessage);
    return () => {
      debugDriver.off(ERemoteDebugDriverExternalEvent.All, handleDriverMessage);
    };
  }, []);



  const onTraceAction = async (start: boolean) => {
    const selectClientId = props.clientId;

    console.log('onTraceAction: ' + JSON.stringify(selectClientId));
    try {
      if (!selectClientId) {
        message.error('Please connect your App first.');
        return;
      }

      let categories: Array<string> = ["*"];
      if (!traceCategories.includes("all")) {
        categories = Array.from(traceCategories.values());
      }
      const enableJSProfiler = jsProfileType !== "disable";
      const config = {
        includedCategories: categories,
        enableSystrace: true,
        JSProfileInterval: enableJSProfiler ? 100 : 0,
        JSProfileType: jsProfileType === 'primjs' ? 'quickjs' : jsProfileType,
      };
      if (props.info.osType === 'Android') {
        await switchUtils.openDevtool(debugDriver, false);
      }
      await switchUtils.openDomTree(debugDriver, false);

      const method = start
        ? TracingMethodStart
        : TracingMethodEnd;
      const res = await sendTraceCommand(debugDriver, method, config);
      if (res?.error) {
        setTraceStarting(selectClientId, false);
        const msg = res?.error?.message;
        if (msg?.indexOf('Failed to get trace controller') >= 0 || msg?.indexOf('Not implemented:') >= 0 || msg?.indexOf('Tracing not enabled') >= 0 || msg?.indexOf('Failed to start tracing') >= 0) {
          showNotSupportError();
          return;
        }
        if (msg?.indexOf("Tracing already started") >= 0) {
          setTraceStarting(selectClientId!!, true);
          message.warning(res.error.message, 2);
          return;
        }
        message.error(res.error.message, 2);
        return;
      }
      if (start) {
        message.success("Tracing Start!", 2);
        setTraceStarting(selectClientId, true);
      } else {
        message.success("Tracing End!", 2);
        setTraceStarting(selectClientId, false);
        setTraceLoading(selectClientId, true);
        const timer = setTimeout(() => {
          console.log("trace timeout");
          const currentTraceDevice = deviceMap[selectClientId ?? 0];
          if (currentTraceDevice?.traceLoading) {
            setTraceLoading(selectClientId!!, false);
            message.warning(
              "Loading trace data timeout, please try again later!"
            );
          }
          // Clear timer
          setTraceTimer(selectClientId, null);
        }, 120000);
        setTraceTimer(selectClientId!!, timer);
      }
    } catch (e) {
      showTimeoutError();
    }
  };

  const renderTopBar = () => {
    const selectClientId = props.clientId;
    let btnName = "Start";
    let selectClientInfo: TraceDeviceInfo | null = null;
    if (selectClientId) {
      selectClientInfo = deviceMap[selectClientId];
      if (selectClientInfo?.traceStarting) {
        btnName = "Stop";
      } else if (selectClientInfo?.traceLoading) {
        btnName = "Loading";
      }
    }

    const cat_options: any[] = [];
    ["all", "lynx", "vitals", "javascript", "jsb"].forEach((cat) => {
      cat_options.push({
        value: cat,
        label: cat,
      });
    });
    const js_profile_options: any[] = [];
    ["disable", "primjs", "v8"].forEach((cat) => {
      js_profile_options.push({
        value: cat,
        label: cat,
      });
    });

    return (
      <div style={{
        width: "100%",
        height: '36px',
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 10,
        marginBottom: 5
      }}>
        <div>
          <Button
            type="primary"
            style={{ borderRadius: "4px" }}
            icon={
              selectClientInfo?.traceStarting ||
                selectClientInfo?.traceLoading ? (
                <LoadingOutlined />
              ) : (
                <PlayCircleOutlined />
              )
            }
            onClick={() => {
              if (selectClientInfo?.traceLoading) {
                message.warning("Loading trace data, please wait!");
                return;
              }
              onTraceAction(!selectClientInfo?.traceStarting);
            }}
          >
            {btnName}
          </Button>
          <Select
            mode="multiple"
            style={{
              marginLeft: 8,
              marginRight: 8,
              minWidth: 100,
              borderRadius: "4px",
            }}
            placeholder="Select Category"
            defaultValue={["all"]}
            onChange={(e) => {
              setCategories(e as string[]);
            }}
            options={cat_options}
          />
          <Space
            style={{
              marginLeft: 8,
              marginRight: 8,
              minWidth: 120,
            }}>
            <span>JS Profile Type:</span>
            <Select
              defaultValue="disable"
              style={{
                minWidth: '96px'
              }}
              onChange={(value) => {
                setJSProfileType(value as JSProfileType);
              }}
              options={js_profile_options}
            />
          </Space>
          <StartupTraceConfig 
            selectClientId={selectClientId}
            selectClientDuration={selectClientInfo?.startupTracingDuration}
            setStartupTracingDuration={setStartupTracingDuration}
            onStartupTracingConfigChanged={onStartupTracingConfigChanged}
            onGetStartupTracingFile={onGetStartupTracingFile} 
          />
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <Button.Group>
            {renderDownloadButton()}
            {renderHistoryButton()}
          </Button.Group>
        </div>
      </div>
    );
  };

  const renderHistoryButton = () => {
    return (
      <Button icon={<HistoryOutlined />} onClick={showDrawer} type="text">
        History
      </Button>
    );
  };

  const renderDownloadButton = () => {
    const url = traceUrl?.replace(`${TRACING_PREFIX}&url=`, "");
    if (!url) {
      return null;
    }
    return (
      <Button
        type="primary"
        style={{
          fontSize: 13,
          borderRadius: '4px',
        }}
        onClick={() => {
          const fileName = `lynx-trace_${Date.now()}.pftrace`.replace(/[\\\/:\*\?"<>\|]/g, '-');
          downloadFile(decodeURIComponent(url), fileName);
        }}
      >
        Download
      </Button>
    );
  };

  const renderPerffetoView = () => {
    const prefix = TRACING_PREFIX;
    const iframeUrl = traceUrl ?? prefix;
    return (
      <iframe
        title="trace"
        src={iframeUrl}
        style={{ flex: "auto", width: "100%", height: "calc(100% - 36px)", border: 'none', paddingBottom: '4px'}}
        allow="clipboard-read; clipboard-write"
      />
    );
  };

  const renderDrawer = () => {
    return (
      <Drawer
        title="Trace history"
        width={700}
        placement="right"
        onClose={closeDrawer}
        open={open}
        footer={
          <Button.Group>
            {historyFiles.length > 0 && (
              <Button onClick={handleSelectedAll}>
                {historyFiles.length === selectedItems.length
                  ? "Unselect All"
                  : "Select All"}
              </Button>
            )}
            {selectedItems.length > 0 && (
              <Popconfirm
                title={`Are you sure to delete these ${selectedItems.length} trace files?`}
                onConfirm={() => {
                  selectedItems.forEach(async (item) => {
                    await deleteHistoryFile(item);
                  });
                  setTimeout(() => {
                    setSelectedItems([]);
                    updateHistoryFile();
                  }, 0);
                }}
                okText="Yes"
                cancelText="No"
              >
                <Button danger>
                  Delete {selectedItems.length} Items
                </Button>
              </Popconfirm>
            )}
          </Button.Group>
        }
      >
        <Checkbox.Group value={selectedItems} onChange={handleSelectedChange}>
          <List
            dataSource={historyFiles}
            size="small"
            renderItem={(item: HistoryFileType) => {
              return (
                <List.Item>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      width: "100%",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Checkbox style={{ marginRight: 10 }} value={item.file} onClick={handleSelectedChange} />
                    <div
                      style={{ fontSize: 13, color: "gray", marginRight: 8 }}
                    >
                      {new Date(item.date).toLocaleString("zh-CN", {
                        hour12: false,
                      })}
                    </div>
                    <Input
                      style={{ width: 200, marginRight: 10 }}
                      type="text"
                      defaultValue={item.name}
                      onChange={async (value: any) => {
                        const fileNamesuffix: string = item.file.substr(
                          item.name.length
                        );
                        await renameHistoryFile(
                          item.name + fileNamesuffix,
                          value + fileNamesuffix
                        );
                        updateHistoryFile();
                      }}
                    />
                    <Button.Group>
                      <Button
                        type="primary"
                        style={{
                          fontSize: 13,
                          marginRight: 8,
                          borderRadius: "4px",
                        }}
                        onClick={() => {
                          setTraceUrl(item.url);
                          setFileName(item.file);
                          closeDrawer();
                        }}
                      >
                        View
                      </Button>
                      <Button
                        type="primary"
                        style={{
                          fontSize: 13,
                          marginRight: 8,
                          borderRadius: "4px",
                        }}
                        onClick={() => {
                          const url = traceUrl?.replace(
                            `${TRACING_PREFIX}&url=`,
                            ""
                          );
                          if (url) {
                            const fileName = `lynx-trace_${Date.now()}.pftrace`.replace(/[\\\/:\*\?"<>\|]/g, '-');
                            downloadFile(decodeURIComponent(url), fileName);
                          }
                        }}
                      >
                        Download
                      </Button>
                      <Popconfirm
                        title="Are you sure to delete this trace?"
                        onConfirm={async () => {
                          await deleteHistoryFile(item.file);
                          setTimeout(() => {
                            setSelectedItems([]);
                            updateHistoryFile();
                          }, 0);
                        }}
                        okText="Yes"
                        cancelText="No"
                      >
                        <Button
                          type="primary"
                          style={{ fontSize: 13, borderRadius: "4px" }}
                        >
                          Delete
                        </Button>
                      </Popconfirm>
                    </Button.Group>
                  </div>
                </List.Item>
              );
            }}
          />
        </Checkbox.Group>
      </Drawer>
    );
  };

  return (
    <div style={{
      width: "100%",
      height: "100%",
      overflow: "hidden",
      margin: 0,
      padding: 0,
    }}>
      {renderTopBar()}
      {renderPerffetoView()}
      {renderDrawer()}
    </div>
  );
};

export default TraceView;
