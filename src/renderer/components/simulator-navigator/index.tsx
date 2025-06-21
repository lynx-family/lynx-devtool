// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import BackImg from '../../assets/imgs/ic_back.svg';
import FowardImg from '../../assets/imgs/ic_foward.svg';
import RefreshImg from '../../assets/imgs/ic_refresh.svg';
import './index.scss';

const SimulatorNavigation = ({
  canGoBack,
  canGoForward,
  handleBack,
  handleForward,
  handleRefresh,
  inputRef,
  handleKeyDown
}) => {
  return (
    <div className="title-bar">
      <BackImg
        onClick={canGoBack ? handleBack : undefined}
        style={{
          opacity: canGoBack ? '1' : '0.5',
          cursor: canGoBack ? 'default' : 'not-allowed'
        }}
      />
      <FowardImg
        onClick={canGoForward ? handleForward : undefined}
        style={{
          opacity: canGoForward ? '1' : '0.5',
          cursor: canGoForward ? 'default' : 'not-allowed'
        }}
      />
      <RefreshImg onClick={handleRefresh} />
      <input
        ref={inputRef}
        onKeyDown={handleKeyDown}
        placeholder="Enter URL / Scheme to open page"
        style={{
          opacity: '1',
          fontSize: '12px'
        }}
      />
    </div>
  );
};

export default SimulatorNavigation;
