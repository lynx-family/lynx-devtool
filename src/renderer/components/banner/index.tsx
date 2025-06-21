// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Alert } from 'antd';
import './index.scss';

export const BANNER_HEIGHT = 50;

export default function LDTBanner({ description, onClose }: { description: string; onClose: () => void }) {
  return <Alert type="info" onClose={onClose} message={description} closable />;
}
