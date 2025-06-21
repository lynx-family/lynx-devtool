// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import './index.scss';

const SimulatorOverlay = ({ onClose, isHomeSimulated }) => {
  return (
    <div className={`simulator-overlay ${isHomeSimulated ? 'simulator-show' : 'simulator-hide'}`}>
      <div className="simulator-overlay-content">
        <p>App has been moved to background</p>
        <button onClick={onClose}>Back to App</button>
      </div>
    </div>
  );
};

export default SimulatorOverlay;
