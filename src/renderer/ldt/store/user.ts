// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import create from '@/renderer/utils/flooks';
import { mergeContext } from '@/renderer/utils/statisticsUtils';
export interface IUser {
  username: string;
  department: {
    name: string;
    en_name: string;
  };
  picture: string;
  emails: Array<string>;
  id: string;
  name: string;
  rolelist: Array<string>;
  employee_id: string;
  email: string;
  _id: string;
  work_country: {
    name: string;
    en_name: string;
  };
}

export type UserStoreType = ReturnType<typeof userStore>;
const userStore = (store: any) => ({
  user: JSON.parse(localStorage.getItem('user_info') || '{}') as IUser,
  appId: localStorage.getItem('app_id'),

  setUser(user: IUser) {
    localStorage.setItem('user_info', JSON.stringify(user));
    if (user._id) {
      mergeContext({ username: user.username, email: user.email });
    }
    store({ user: { ...user } });
  },


  setAppId(appId: string) {
    localStorage.setItem('app_id', appId);
    store({ appId });
  }
});

const useUser = create(userStore);
export default useUser;
