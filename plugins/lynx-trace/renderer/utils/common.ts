// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { IDeviceInfo } from "../types/trace";

export const downloadFile = async (url: string, fileName: string) => {
  const resp = await fetch(url);
  if (!resp.ok) {
    console.error(`trace download file failed ${resp.status} ${resp.statusText}`);
    return;
  }
  const blob = await resp.blob();
  const fileUrl = URL.createObjectURL(blob);
  const linkElement = document.createElement('a');
  linkElement.style.display = 'none';
  linkElement.href = fileUrl;
  linkElement.download = fileName;
  document.body.appendChild(linkElement);
  linkElement.click();
  linkElement.remove();
  URL.revokeObjectURL(fileUrl);
};
export function getFileName(clientInfo?: IDeviceInfo) {
  let fileName = `${clientInfo?.App}(${clientInfo?.deviceModel})___${new Date().toISOString()}`;
  // trim
  fileName = `${fileName.replace(/\s*/g, '')}`;
  return fileName;
}
