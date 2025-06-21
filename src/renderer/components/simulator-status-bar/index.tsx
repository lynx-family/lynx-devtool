// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useEffect, useState } from 'react';
import './index.scss';

export const StatusBar = ({ height }: { height: number }) => {
  const [time, setTime] = useState<string>(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [batteryLevel, setBatteryLevel] = useState<number>(100);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let battery;
    const getBatteryLevel = async () => {
      battery = await (navigator as any).getBattery();
      setBatteryLevel(battery.level * 100);

      battery.addEventListener('levelchange', () => {
        setBatteryLevel(battery.level * 100);
      });
    };

    getBatteryLevel();

    return () => {
      battery.removeEventListener('levelchange', () => {
        setBatteryLevel(battery.level * 100);
      });
    };
  }, []);

  return (
    <div className="status-bar" style={{ height }}>
      <span>{time}</span>
      <span>{batteryLevel}%</span>
    </div>
  );
};
