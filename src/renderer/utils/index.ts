// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { WEBVIEW, WEBVIEW_POPUP, LYNX, LYNX_POPUP } from '../constants';

const searchParams = new URLSearchParams(window.location.search);
export const viewMode = searchParams.get('viewMode');
export const isLynxMode = viewMode === 'lynx';
export const isWebMode = viewMode === 'web';

export const WS = searchParams.get('ws');
export const ROOM_ID = searchParams.get('room');

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
}

export async function checkContentType(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (response.status >= 400) {
      return true;
    }
    const contentType = response.headers.get('content-type') ?? response.headers.get('Content-Type');
    return contentType?.includes('text/html') ?? false;
  } catch (_) {
    return true;
  }
}

export function getUrlFromSchema(schema: string): string | null {
  try {
    const url = new URL(schema);
    if (url.protocol.startsWith('http')) {
      return schema;
    }
    return url.searchParams.get('url') || url.searchParams.get('surl');
  } catch (_) {
    return null;
  }
}

export const extractUrlFromScheme = (scheme: string): string | null => {
  try {
    const url = new URL(scheme);
    const urlParam = url.searchParams.get('url');
    return urlParam ? decodeURIComponent(urlParam) : null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

export const parseSchemeUrl = (schemeUrl: string) => {
  if (!schemeUrl) {
    return Array(1).fill({ key: '', value: '' });
  }
  const [protocol, queryString = ''] = schemeUrl.split('?');
  if (!queryString) {
    return [{ key: 'protocol', value: protocol }];
  }

  const paramsArray = queryString.split('&').map((param) => {
    const [key, value] = param.split('=');
    return { key, value: decodeURIComponent(value) };
  });

  return [{ key: 'protocol', value: protocol }, ...paramsArray];
};

export const buildSchemeUrl = (paramsArray: { key: string; value: string }[]): string => {
  if (!paramsArray || paramsArray.length === 0) {
    return '';
  }

  const protocol = paramsArray.find((param) => param.key === 'protocol')?.value || '';
  const queryString = paramsArray
    .filter((param) => param.key !== 'protocol')
    .map((param) => `${param.key}=${encodeURIComponent(param.value)}`)
    .join('&');

  return `${protocol}?${queryString}`;
};
