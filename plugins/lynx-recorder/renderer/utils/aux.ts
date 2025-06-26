// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import zlib from 'zlib';
import { Buffer } from 'buffer';

function isResourceUrl(urlString: string) {
  const urlRegex = /(^\s*\S+:\/\/\S+\.(?:jpg|jpeg|png|gif|svg|image|webp))(?:\S*)/gi;
  return urlRegex.test(urlString.trim());
}

function getResourceUrlBetweenQuotes(str: string) {
  const regex = /"(.*?)"/g;
  const matches: string[] = [];
  let match;

  while ((match = regex.exec(str))) {
    if (isResourceUrl(match[1])) {
      matches.push(match[1]);
    }
  }
  return matches;
}

function decodeLynxRecorderData(buffer: ArrayBuffer) {
  const bufferString = new TextDecoder().decode(buffer);
  let result = null;
  try {
    const output = zlib.inflateSync(Buffer.from(bufferString, 'base64'));
    result = JSON.parse(output.toString());
  } catch (err: any) {
    console.warn(err.message);
  }
  return result;
}

function encodeLynxRecorderData(raw: string) {
  const base64Data = zlib.deflateSync(raw).toString('base64');
  const uInt8Array = new Uint8Array(base64Data.length);
  for (let i = 0; i < base64Data.length; ++i) {
    uInt8Array[i] = base64Data.charCodeAt(i);
  }
  return uInt8Array;
}

export function checkValid(buffer: ArrayBuffer): [boolean, string] {
  const decodeData: any = decodeLynxRecorderData(buffer);
  if (decodeData === null) {
    return [false, 'decode failed'];
  } else if (!decodeData['Action List']) {
    return [false, 'no action in record file'];
  } else {
    const found = decodeData['Action List'].find(
      (element: any) => element['Function Name'] === 'loadTemplate' || element['Function Name'] === 'loadTemplateBundle'
    );
    if (found === undefined) {
      return [false, 'The recording file is incomplete, please start record before the page opens'];
    } else {
      return [true, ''];
    }
  }
}

export const exportedForTesting = {
  decodeLynxRecorderData,
  getResourceUrlBetweenQuotes,
  encodeLynxRecorderData,
  checkValid
};
