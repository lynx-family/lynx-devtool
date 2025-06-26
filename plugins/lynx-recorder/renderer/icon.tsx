// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import LynxRecorderLogo from './assets/lynx-recorder-logo.png';
import { Image } from 'antd';
const Index = () => {
  return (
    <Image
      src={LynxRecorderLogo}
      style={{
        width: 20,
        height: 20
      }}
      preview={false}
    />
  );
};

export default Index;
