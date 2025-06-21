// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Use this class as return when one request corresponds to multiple responses
 */
export class MultiResponse {
  private _data: any[] = [];

  put(response: any) {
    this._data.push(response);
  }

  getData() {
    return this._data;
  }
}
abstract class BaseHandler {
  abstract getName(): string;
  abstract handle(params?: any): Promise<any>;
}

export default BaseHandler;
