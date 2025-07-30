// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import useConnection from "@/renderer/hooks/connection";
import LDT_CONST from "@/renderer/utils/const";
import { IDeviceInfo } from "@lynx-js/devtool-plugin-core/renderer";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { Col, Row, Switch, Tooltip } from "antd";
import { useState, useMemo } from "react";
import "./SessionSelectHeader.scss";

// eslint-disable-next-line max-lines-per-function
const PageSession = () => {
  const {
    deviceInfoMap,
    selectedDevice: device,
    setSelectedSession,
    setStopAtEntry,
    setStopLepusAtEntry,
    setFetchDebugInfo,
  } = useConnection();
  const [autoFocus, setAutoFocus] = useState(
    localStorage.getItem(LDT_CONST.KEY_AUTO_FOCUS_LAST_SESSION) !== "false"
  );

  if (!device) {
    return null;
  }
  const deviceItem: IDeviceInfo = deviceInfoMap[device.clientId ?? 0];
  if (!deviceItem) {
    return null;
  }

  const { info } = device;
  const handleFocusChange = (value: boolean) => {
    localStorage.setItem(LDT_CONST.KEY_AUTO_FOCUS_LAST_SESSION, `${value}`);
    setAutoFocus(value);
    if (value && deviceItem.sessions && deviceItem.sessions.length > 0) {
      setSelectedSession(deviceItem.sessions[0].session_id);
    }
  };

  return (
    <div className="device-session-info">
      <span className={"panel-header"}>Information</span>
      <div className={"device-info-item"}>
        <span className={"left-panel-title"}>App Name</span>
        <span className={"left-panel-value"}>{info.App}</span>
      </div>
      <div className={"device-info-item"}>
        <span className={"left-panel-title"}>App Version</span>
        <span className={"left-panel-value-ono"}>{info.AppVersion}</span>
      </div>
      <div className={"device-info-item"}>
        <span className={"left-panel-title"}>OS Version</span>
        <span className={"left-panel-value-ono"}>
          {info.osVersion}
          {info.osType === "iOS" && info.osSupportWebDevtool === "false" && (
            <strong> OS version does not support WebView debugging</strong>
          )}
        </span>
      </div>

      <div className={"device-info-item"}>
        <span className={"left-panel-title"}>Lynx Version</span>
        <span className={"left-panel-value-ono"}>{info.sdkVersion}</span>
      </div>

      {info.ldtVersion && (
        <div className={"device-info-item"}>
          <span className={"left-panel-title"}>LDT Version</span>
          <span className={"left-panel-value-ono"}>{info.ldtVersion}</span>
        </div>
      )}

      <span className={"panel-header"}>Settings</span>
      <Row>
        <Col span={12}>
          <div className={"device-info-item"}>
            <span className={"left-panel-title"}>BTS First Line BPs</span>
            <Switch
              className={"right-panel-input"}
              size="small"
              checked={deviceItem.stopAtEntry}
              onChange={setStopAtEntry}
            />
          </div>
        </Col>
        <Col span={12}>
          <div className={"device-info-item"}>
            <span className={"left-panel-title"}>MTS First Line BPs</span>
            <Switch
              className={"right-panel-input"}
              size="small"
              checked={deviceItem.stopLepusAtEntry}
              onChange={setStopLepusAtEntry}
            />
          </div>
        </Col>
        <Col span={12}>
          <div className={"device-info-item"}>
            <span className={"left-panel-title"}>MTS Debug</span>
            <Switch
              className={"right-panel-input"}
              size="small"
              checked={deviceItem.fetchMTSDebugInfo}
              onChange={(checked) => {
                setFetchDebugInfo('MTS', checked);
              }}
            />
          </div>
        </Col>
      </Row>
      <Row>
        <Col span={12}>
          <div className={"device-info-item"}>
            <span className={"left-panel-title"}>
              <a>Focus on Latest Card</a>
            </span>
            <Switch
              className={"right-panel-input"}
              size="small"
              checked={autoFocus}
              onChange={(checked) => {
                handleFocusChange(checked);
                // checked && setKeepCardOpen(false);
              }}
            />
            <Tooltip
              title={
                <span style={{ color: "white", wordBreak: "break-word" }}>
                  When enabled, will automatically focus on the latest card
                  <br />
                  When disabled, manual focus is required
                </span>
              }
            >
              <QuestionCircleOutlined
                className="icon-help-circle"
                style={{ fontSize: "12px" }}
              />
            </Tooltip>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default PageSession;
