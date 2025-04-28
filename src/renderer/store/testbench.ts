import create from '../utils/flooks';

export interface TestbenchItem {
  id: number;
  pic: string;
  url: string;
  cdn: string;
  appName?: string;
  deviceModel?: string;
  osType?: string;
  isValid: boolean;
  message: any;
}

export interface TestBenchDeviceInfo {
  testbenchStarting: boolean;
  testbenchLoading: boolean;
  testbenchTimer: NodeJS.Timeout | null;
}

export type TestbenchStoreType = ReturnType<typeof testbenchStore>;
const testbenchStore = (store: any) => ({
  starting: false,
  loading: false,
  testbenchList: [] as TestbenchItem[],
  screenshotMap: {} as Record<string, any>,
  deviceMap: {} as Record<number, TestBenchDeviceInfo>,
  setTestbenchList: (testbenchList: TestbenchItem[]) => {
    store({ testbenchList: [...testbenchList] });
  },
  addTestbenchData: (testbench: TestbenchItem) => {
    const { testbenchList } = store() as TestbenchStoreType;
    testbenchList.unshift(testbench);
    store({ testbenchList: [...testbenchList] });
  },
  removeTestbench: (testbenchId: number) => {
    if (testbenchId) {
      const { testbenchList } = store() as TestbenchStoreType;
      store({ testbenchList: testbenchList.filter((testbench) => testbench.id !== testbenchId) });
    }
  },
  addScreenshot: (sessionId: number, data: any) => {
    if (sessionId && data) {
      const { screenshotMap } = store() as TestbenchStoreType;
      screenshotMap[sessionId.toString()] = data;
      store({ screenshotMap: { ...screenshotMap } });
    }
  },
  removeAllTestBench: () => {
    store({ testbenchList: [] });
  },

  setTestbenchStarting: (clientId: number, value: boolean) => {
    const { deviceMap } = store() as TestbenchStoreType;
    const deviceInfo = deviceMap[clientId];
    if (deviceInfo) {
      deviceInfo.testbenchStarting = value;
    } else {
      deviceMap[clientId] = {
        testbenchStarting: value,
        testbenchLoading: false,
        testbenchTimer: null
      };
    }
    store({ deviceMap: { ...deviceMap } });
  },
  setTestbenchLoading: (clientId: number, value: boolean) => {
    const { deviceMap } = store() as TestbenchStoreType;
    const deviceInfo = deviceMap[clientId];
    if (deviceInfo) {
      deviceInfo.testbenchLoading = value;
    } else {
      deviceMap[clientId] = {
        testbenchStarting: false,
        testbenchLoading: value,
        testbenchTimer: null
      };
    }
    store({ deviceMap: { ...deviceMap } });
  },
  setTestbenchTimer: (clientId: number, timer: NodeJS.Timeout | null) => {
    const { deviceMap } = store() as TestbenchStoreType;
    const deviceInfo = deviceMap[clientId];
    if (deviceInfo) {
      deviceInfo.testbenchTimer = timer;
    } else {
      deviceMap[clientId] = {
        testbenchStarting: false,
        testbenchLoading: false,
        testbenchTimer: timer
      };
    }
    store({ deviceMap: { ...deviceMap } });
  }
});

const useTestbench = create(testbenchStore);
export default useTestbench;
