// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import '@lynx-js/types';

// The Lynx <svg> element renders an SVG source. @lynx-js/types does not declare
// it yet, so declare only the attributes the Home page uses.
declare module '@lynx-js/types' {
  interface IntrinsicElements {
    svg: {
      src: string;
      className?: string;
    };
  }
}
