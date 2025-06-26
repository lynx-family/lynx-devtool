// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { definePlugin, MainContext } from '@lynx-js/devtool-plugin-core/main';
import fs from 'fs-extra';
import path from 'path';

const traceFileSuffix = '.pftrace';
let _params: any

const bridge = (context: MainContext) => ({
  // Delete a local trace file
  deleteLocalFile: (fileName: string) => {
    try {
      const filePath = path.resolve(context.constants.LDT_DIR, 'files/trace', fileName);
      fs.removeSync(filePath);
    } catch (error) {
      console.error(`[Lynx Trace] delete local file failed. ${error.message}`);
    }
  },
  
  // Rename a local trace file
  renameLocalFile: (oldName: string, newName: string) => {
    try {
      const uploadFilePath = path.resolve(context.constants.LDT_DIR, 'files/trace');
      const oldPath = `${uploadFilePath}/${oldName}`;
      const newPath = `${uploadFilePath}/${newName}`;
      if (oldName && newName && fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
      } else {
        console.error(`[Lynx Trace] rename local file failed. params invalid`);
      }
    } catch (error) {
      console.error(`[Lynx Trace] rename local file failed. ${error.message}`);
    }
  },

  // Upload file buffer to local storage
  uploadFileToLocal: (fileBuffer: Array<Buffer>, fileName: string) => {
    try {
      if (!_params || !_params.ldtUrl) {
        return Promise.reject('Missing required parameters for uploadFileToLocal');;
      }
      const {ldtUrl } = _params;
      const { host } = new URL(ldtUrl);

      const filePath = path.resolve(context.constants.LDT_DIR, 'files/trace', fileName);
      fs.createFileSync(filePath);
      fs.writeFileSync(filePath, Buffer.concat(fileBuffer));
      return Promise.resolve({
        code: 0,
        file: fileName,
        url: `http://${host}/localResource/file/trace/${fileName}`,
        message: 'Upload Success'
      });
    } catch (error) {
      return Promise.reject(error.message);
    }
  },
  
  // Get list of trace files with metadata
  getFileList: () => {
    try {
      if (!_params || !_params.ldtUrl) {
        return Promise.reject('Missing required parameters for getFileList');;
      }
      
      const {ldtUrl } = _params;
      const { host } = new URL(ldtUrl);

      const uploadFilePath = path.resolve(context.constants.LDT_DIR, 'files/trace');
      if (!fs.existsSync(uploadFilePath)) {
        fs.mkdirSync(uploadFilePath, { recursive: true });
      }
      const files = fs.readdirSync(uploadFilePath);
      const list: any[] = [];
      files.forEach((file: string) => {
        if (file.indexOf(traceFileSuffix) >= 0) {
          const sepList = file.split('___');
          const date = sepList[1]?.replace(traceFileSuffix, '')
                      .replace('T', 'T')
                      .replace(/-(\d{2})-(\d{2}\.\d+Z)$/, (_, m1, m2) => `:${m1}:${m2}`) 
                ?? new Date().toISOString();
          const fileInfo = {
            file,
            name: sepList[0],
            date,
            url: `http://${host}/localResource/file/trace/${file}`,
          };
          list.push(fileInfo);
        }
      });
      // Sort files by date (newest first)
      list.sort((a: any, b: any) => {
        const aDate = new Date(a?.date);
        const bDate = new Date(b?.date);
        return aDate > bDate ? -1 : 1;
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
  },

  // Get URL prefix for trace viewer
  tracePrefix: () => {
    if (!_params || !_params.ldtUrl) {
      console.warn('Missing required parameters for tracePrefix');
      return undefined;
    }
    
    const {ldtUrl } = _params;
    const { host } = new URL(ldtUrl);
    return `http://${host}/localResource/trace/index.html#!/?hide=true`;
  }
});


export type AsyncBridgeType = ReturnType<typeof bridge>;

export default definePlugin<AsyncBridgeType>({
  asyncBridge: bridge,
  onCreate(_, params) {
    _params = params;
  },
  onRestart(_, params) {
    _params = params;
  }
});


