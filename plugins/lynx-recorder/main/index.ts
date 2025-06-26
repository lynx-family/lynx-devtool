// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { definePlugin, MainContext } from '@lynx-js/devtool-plugin-core/main';
import path from 'path';
import fs from 'fs-extra';

const lynxRecorderFilePrefix = 'lynxrecorder';

let _params: any;

const bridge = (context: MainContext) => ({
  deleteLocalFile: (fileName: string) => {
    try {
      const filePath = path.resolve(context.constants.LDT_DIR, 'files/lynxrecorder', fileName);
      fs.removeSync(filePath);
    } catch (error) {
      console.error(`[LynxRecorder] delete local file failed. ${error.message}`);
    }
  },
  renameLocalFile: (oldName: string, newName: string) => {
    try {
      const uploadFilePath = path.resolve(context.constants.LDT_DIR, 'files/lynxrecorder');
      const oldPath = `${uploadFilePath}/${oldName}`;
      const newPath = `${uploadFilePath}/${newName}`;
      if (oldName && newName && fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
      } else {
        console.error(`[LynxRecorder] rename local file failed. params invalid`);
      }
    } catch (error) {
      console.error(`[LynxRecorder] rename local file failed. ${error.message}`);
    }
  },
  uploadFileToLocal: (fileBuffer: Array<Buffer>, fileName: string) => {
    try {
      const filePath = path.resolve(context.constants.LDT_DIR, 'files/lynxrecorder', fileName);
      fs.createFileSync(filePath);
      fs.writeFileSync(filePath, Buffer.concat(fileBuffer));
      return Promise.resolve({
        code: 0,
        file: fileName,
        url: `${new URL(_params.ldtUrl).origin}/localResource/file/lynxrecorder/${fileName}`,
        message: 'download success!'
      });
    } catch (error) {
      return Promise.reject(error.message);
    }
  },
  getFileList: () => {
    try {
      const uploadFilePath = path.resolve(context.constants.LDT_DIR, 'files/lynxrecorder');
      if (!fs.existsSync(uploadFilePath)) {
        fs.mkdirSync(uploadFilePath, { recursive: true });
      }
      const files = fs.readdirSync(uploadFilePath);
      const list: any[] = [];
      files.forEach((file: string) => {
        if (file.startsWith(lynxRecorderFilePrefix)) {
          const fileInfo = {
            file,
            name: file,
            url: `${new URL(_params.ldtUrl).origin}/localResource/file/lynxrecorder/${file}`
          };
          list.push(fileInfo);
        }
      });
      return Promise.resolve({
        code: 0,
        data: list,
        message: 'success'
      });
    } catch (error) {
      return Promise.resolve({
        code: -1,
        message: error,
        data: []
      });
    }
  }
});

export type LynxRecorderBridgeType = ReturnType<typeof bridge>;
export default definePlugin<LynxRecorderBridgeType>({
  asyncBridge: bridge,
  onCreate(_, params) {
    _params = params;
  },
  onRestart(_, params) {
    _params = params;
  }
});
