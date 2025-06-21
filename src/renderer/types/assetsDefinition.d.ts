// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.webp';
declare module '*.ttf';
declare module '*.woff';
declare module '*.woff2';
declare module '*.scss';
declare module '*.less';
declare module '*.css';
declare module '*.svg';
declare module '*.svg?url';
declare module '*.module.css';
declare module 'copy-text-to-clipboard';

interface Window {
  iii: any;
  ldtElectronAPI: {
    send: (name, params) => void;
    invoke: (name, params) => Promise<any>;
    on: (key, listener) => void;
    once: (key, listener) => void;
    off: (key, listener) => void;
  } & Record<string, any>;
}
