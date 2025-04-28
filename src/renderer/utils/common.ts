import { IDevice } from '@/renderer/types/device'

export function getFileName(selectedDevice: IDevice) {
  let fileName = `${selectedDevice?.info?.App}(${selectedDevice?.info?.deviceModel})___${new Date().toISOString()}`;
  // trim
  fileName = `${fileName.replace(/\s*/g, '')}`;
  return fileName;
}

export const downloadFile = async (url: string, fileName: string) => {
  const resp = await fetch(url);
  if (!resp.ok) {
    console.error(`testbench download file failed ${resp.status} ${resp.statusText}`);
    return;
  }

  const blob = await resp.blob();
  const fileUrl = URL.createObjectURL(blob);
  const linkElement = document.createElement('a');
  linkElement.style.display = 'none';
  linkElement.href = fileUrl;
  linkElement.download = fileName;
  document.body.appendChild(linkElement);
  linkElement.click();
  linkElement.remove();
  URL.revokeObjectURL(fileUrl);
};
