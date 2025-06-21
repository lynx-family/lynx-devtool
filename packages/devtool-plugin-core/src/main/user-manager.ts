// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface IUserInfo {
  info: {
    uid: string;
    sec_uid: string;
    unique_id: string;
    nickname: string;
    avatar_larger?: any;
    other_avatar_uri?: string;
    short_id: string;
    bind_phone: string;
    _curEnv: string;
  };
  cookie: any[];
}

export interface IUserManager {
  getUsers: () => IUserInfo[];
  getEnvUsers: () => IUserInfo[];
  getSelectedUser: () => IUserInfo | null;
  setSelectedUID: (uid: string | undefined) => void;
  login: (extraData?: any) => Promise<any>;
  loginByCookie: (cookie: Record<string, string>[]) => Promise<any>;
  clearSessionCookies: () => void;
  removeUser: (uid: string) => void;
  autoChangeSelectedUID: () => void;
}
