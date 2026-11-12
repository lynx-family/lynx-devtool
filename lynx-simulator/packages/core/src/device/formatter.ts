import type { SimulatorDevice } from './types';

export function formatDevices(devices: readonly SimulatorDevice[]): string {
  const rows = devices.map((device) => ({
    name: device.name,
    size: `${device.size.width}x${device.size.height}`,
    devicePixelRatio: device.devicePixelRatio === undefined ? '' : String(device.devicePixelRatio),
    platform: device.platform ?? '',
    label: device.label ?? '',
  }));

  const nameWidth = getColumnWidth(
    'Name',
    rows.map((row) => row.name)
  );
  const sizeWidth = getColumnWidth(
    'Size',
    rows.map((row) => row.size)
  );
  const devicePixelRatioWidth = getColumnWidth(
    'DPR',
    rows.map((row) => row.devicePixelRatio)
  );
  const platformWidth = getColumnWidth(
    'Platform',
    rows.map((row) => row.platform)
  );
  const lines = [
    [
      padEnd('Name', nameWidth),
      padEnd('Size', sizeWidth),
      padEnd('DPR', devicePixelRatioWidth),
      padEnd('Platform', platformWidth),
      'Label',
    ].join('  '),
  ];

  for (const row of rows) {
    lines.push(
      [
        padEnd(row.name, nameWidth),
        padEnd(row.size, sizeWidth),
        padEnd(row.devicePixelRatio, devicePixelRatioWidth),
        padEnd(row.platform, platformWidth),
        row.label,
      ].join('  ')
    );
  }

  return [
    lines.join('\n'),
    '',
    'DPR only affects windowless rendering. Windowed rendering uses the host display scale.',
  ].join('\n');
}

function getColumnWidth(header: string, values: string[]): number {
  return Math.max(header.length, ...values.map((value) => value.length));
}

function padEnd(value: string, width: number): string {
  return value.padEnd(width, ' ');
}
