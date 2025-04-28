import * as utils from '.';

export async function uploadFileBuffer(buffer: Array<Buffer>, fileName?: string) {
  const res = await utils.uploadFileBufferToLocal(buffer, fileName, 'testbench');
  return res;
}
