// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type IDownloadNpmPackage = (
  pkgName: string,
  pkgVersion: string,
  destRelativePath: string,
  options: {
    localVersion?: string;
    checkVersion?: boolean;
  },
  progressListener?: (progress: number) => void
) => Promise<string | boolean>;

export type IGetVersionFromPackageJson = (pkgDir: string, repeatParent?: boolean) => Promise<[string?, string?]>;
