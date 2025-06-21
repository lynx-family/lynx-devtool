// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable max-lines-per-function */
import { getDeviceById, getDeviceId } from '@/renderer/utils/device';
import { DeleteOutlined, AppstoreOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { Button, Col, Form, Popconfirm, Popover, Row, Select, message, Tooltip, Input, InputNumber } from 'antd';
import './index.scss';

const CustomDevicePopOver = (props) => {
  const { onSubmit } = props;
  return (
    <div
      className="custom-device-popover"
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <Form onFinish={onSubmit}>
        <Form.Item name="name" initialValue="custom">
          <Input placeholder="Please enter device name" />
        </Form.Item>
        <Form.Item name="width" initialValue={390}>
          <InputNumber placeholder="Please enter width" />
        </Form.Item>
        <Form.Item name="height" initialValue={844}>
          <InputNumber placeholder="Please enter height" />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          OK
        </Button>
      </Form>
    </div>
  );
};

const SimulatorTools = (props) => {
  const zoomOptions = [50, 75, 85, 100, 125, 150];
  const { zoomLevel, handleZoomChange, simulations, handleDeviceChange, combinedDevices, addDevice, deleteDevice } =
    props;

  const handleCustomDeviceChange = (device) => {
    if (device === 'custom') {
      return;
    }
    handleDeviceChange(device);
  };

  const columns = 3;
  const renderTooltipContent = () => {
    return (
      <div className="tooltip-content">
        {Array.from({ length: Math.ceil(simulations.length / columns) }, (_, index) => (
          <Row justify="space-around" gutter={24} key={index}>
            {simulations.slice(index * columns, (index + 1) * columns).map(({ title, action, icon, message: messageText }) => (
              <Col span={24 / columns} key={title}>
                <div
                  className="tooltip-content-item"
                  onClick={() => {
                    action();
                    if (messageText) {
                      message.info(messageText);
                    }
                  }}
                >
                  <div className="tooltip-content-item-icon">{icon}</div>
                  <span className="tooltip-content-item-title">{title}</span>
                </div>
              </Col>
            ))}
          </Row>
        ))}
      </div>
    );
  };

  return (
    <div className="tool-bar">
      <div>
        {combinedDevices.length > 0 && (
          <Select
            style={{ width: 150 }}
            dropdownStyle={{ width: 250 }}
            className="tool-bar-select"
            size="small"
            placeholder="Please select a simulator model"
            value={props.device}
            onChange={handleCustomDeviceChange}
            dropdownRender={(menu) => (
              <div>
                {menu}
                <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: 8 }}>
                  <Popover
                    placement="right"
                    content={
                      <CustomDevicePopOver
                        onSubmit={(device) => {
                          addDevice({
                            label: device.name,
                            value: {
                              width: device.width,
                              height: device.height,
                              statusBarHeight: 0
                            },
                            deviceType: 'custom'
                          });
                        }}
                      />
                    }
                  >
                    <Button icon={<PlusCircleOutlined />} block type="text" style={{ textAlign: 'left' }}>
                      custom
                    </Button>
                  </Popover>
                </div>
              </div>
            )}
          >
            <Select.OptGroup label="Default Devices">
              {combinedDevices
                .filter((device) => device.deviceType === 'builtin')
                .map((device) => (
                  <Select.Option value={getDeviceId(device)} key={getDeviceId(device)}>
                    <div className="simulator-custom-select-item">
                      <div>{device.label}</div>
                    </div>
                  </Select.Option>
                ))}
            </Select.OptGroup>
            <Select.OptGroup label="Custom Devices">
              {combinedDevices
                .filter((device) => device.deviceType === 'custom')
                .map((device) => {
                  return (
                    <Select.Option value={getDeviceId(device)} key={getDeviceId(device)}>
                      <div className="simulator-custom-select-item">
                        <div>{device.label}</div>
                        {(!device.deviceType || device.deviceType === 'custom') && (
                          <Popconfirm
                            title="Delete"
                            description={`Are you sure you want to delete device (${device.label})?`}
                            okType="danger"
                            onConfirm={() => deleteDevice(device)}
                          >
                            <DeleteOutlined className="semi-select-delete-icon" />
                          </Popconfirm>
                        )}
                      </div>
                    </Select.Option>
                  );
                })}
            </Select.OptGroup>
            <Select.OptGroup label="Real Devices">
              {combinedDevices
                .filter((device) => device.deviceType === 'client')
                .map((device) => {
                  return (
                    <Select.Option value={getDeviceId(device)} key={getDeviceId(device)}>
                      <div className="simulator-custom-select-item">
                        <div>{device.label}</div>
                        {(!device.deviceType || device.deviceType === 'client') && (
                          <Popconfirm
                            title="Delete"
                            description={`Are you sure you want to delete device (${device.label})?`}
                            okType="danger"
                            onConfirm={() => deleteDevice(device)}
                          >
                            <DeleteOutlined className="semi-select-delete-icon" />
                          </Popconfirm>
                        )}
                      </div>
                    </Select.Option>
                  );
                })}
            </Select.OptGroup>
          </Select>
        )}

        <Select
          size="small"
          className="tool-bar-select"
          value={zoomLevel}
          onChange={handleZoomChange}
        >
          {zoomOptions.map((option) => (
            <Select.Option value={option} key={option}>
              <div className="simulator-custom-select-item">{option}%</div>
            </Select.Option>
          ))}
        </Select>
      </div>
      <Tooltip title={renderTooltipContent()} placement="bottom" mouseLeaveDelay={500}>
        <AppstoreOutlined className="tool-bar-button" />
      </Tooltip>
    </div>
  );
};

export default SimulatorTools;
