// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as ReactDOM from 'react-dom';
import App from './App';
import { initStatistics } from '@/renderer/utils/statisticsUtils';

initStatistics();

const AppWrapper = () => {
  return (
    <App />
  );
};

ReactDOM.render(<AppWrapper />, document.getElementById('root'));
