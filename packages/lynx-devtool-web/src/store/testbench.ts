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

export type TestbenchStoreType = ReturnType<typeof testbenchStore>;
const testbenchStore = (store: any) => ({
  starting: false,
  loading: false,
  testbenchList: [] as TestbenchItem[],
  screenshotMap: {} as any,
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
  }
});

const useTestbench = create(testbenchStore);
export default useTestbench;
