// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import React from 'react';
import ReactDOM from 'react-dom';
import { Smartphone, Monitor, Info } from 'lucide-react';
import './index.scss';
const ipcRenderer = window.iii;
import { initStatistics, sendStatisticsEvent } from '@/renderer/utils/statisticsUtils';

interface DebugModeSelectorProps {
  onSelect: (mode: 'simulator' | 'mobile') => void;
}

const DebugModeSelector: React.FC<DebugModeSelectorProps> = ({ onSelect }) => {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        <h1 className="text-2xl text-center text-gray-800 mb-12">Select Default Debug Mode</h1>
        <div className="flex justify-center gap-6 mb-12">
          <button
            onClick={() => onSelect('simulator')}
            className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col items-center text-center w-52"
          >
            <Monitor className="w-12 h-12 text-blue-500 mb-3" />
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Simulator Debug</h2>
            <p className="text-xs text-gray-600">Test your application in simulated environment</p>
          </button>
          <button
            onClick={() => onSelect('mobile')}
            className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col items-center text-center w-52"
          >
            <Smartphone className="w-12 h-12 text-green-500 mb-3" />
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Real Device Debug</h2>
            <p className="text-xs text-gray-600">Test your application on actual device</p>
          </button>
        </div>
        <div className="text-center text-gray-600 flex items-center justify-center">
          <Info className="w-4 h-4 mr-2" />
          <span className="text-xs">Your choice can be changed later</span>
        </div>
      </div>
    </div>
  );
};

export default DebugModeSelector;

const Guide: React.FC = () => {
  const handleModeSelect = (mode: 'simulator' | 'mobile') => {
    sendStatisticsEvent({
      name: 'ldt-v3-choose-debugger',
      categories: {
        choice: mode
      }
    });
    ipcRenderer.send('set-debug-mode', mode);
  };

  return <DebugModeSelector onSelect={handleModeSelect} />;
};

initStatistics();

ReactDOM.render(<Guide />, document.getElementById('root'));
