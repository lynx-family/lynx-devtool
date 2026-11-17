// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type AppTheme = 'light' | 'dark';

const APP_BACKGROUND_COLORS: Record<AppTheme, string> = {
  light: '#ffffff',
  dark: '#000000',
};

let appTheme: AppTheme = 'light';

export function getAppTheme(): AppTheme {
  return appTheme;
}

export function setAppTheme(theme: AppTheme): void {
  appTheme = theme;
}

export function getAppWindowBackgroundColor(): string {
  return APP_BACKGROUND_COLORS[appTheme];
}
