// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import DevToolSvg from '@/assets/icons/devtool.svg';
import { ToolOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { t } from 'i18next';
import { Suspense, lazy, useMemo } from 'react';
import CacheRoutes, { RouterConfig } from './components/CacheRoutes/CacheRoutes';
import TestBench from './components/TestBench';

const DevTool = lazy(() => import('./containers/DevTool/DevTool'));

// eslint-disable-next-line max-lines-per-function
export function getRouters(): Array<RouterConfig> {
  return [
    {
      title: t('router_home'),
      path: '/',
      redirect: 'devtool',
      isMenu: false
    },
    {
      title: 'Lynx DevTool',
      icon: <ToolOutlined style={{ fontSize: 18 }} />,
      path: '/devtool',
      element: <DevTool />,
      isMenu: true,
      keepAlive: true
    },
    {
      title: 'Lynx TestBench',
      icon: <VideoCameraOutlined style={{ fontSize: 18 }} />,
      path: '/testbench',
      element: <TestBench />,
      isMenu: true,
      keepAlive: true
    }
  ];
}

const Router = () => {
  const routers = useMemo(() => {
    return getRouters();
  }, []);
  return (
    <Suspense fallback={null}>
      <CacheRoutes routes={routers} />
    </Suspense>
  );
};

export default Router;
