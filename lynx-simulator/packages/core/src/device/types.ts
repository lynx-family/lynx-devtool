import type { SimulatorSize } from '../runtime/types';

export type SimulatorDevicePlatform = 'ios' | 'android' | 'harmony' | 'desktop';

export interface SimulatorDevice {
  name: string;
  label?: string;
  size: SimulatorSize;
  /**
   * Device pixel ratio used by windowless rendering. Windowed rendering uses
   * the host display scale.
   */
  devicePixelRatio?: number;
  platform?: SimulatorDevicePlatform;
}

export interface RegisterDeviceResult {
  device: SimulatorDevice;
  overwritten?: SimulatorDevice;
}
