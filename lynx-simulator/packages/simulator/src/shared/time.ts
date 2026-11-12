export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  return `${year}-${month}-${day}`;
}

export function formatLocalDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hours = padDatePart(date.getHours());
  const minutes = padDatePart(date.getMinutes());
  const seconds = padDatePart(date.getSeconds());
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  const timezoneOffset = formatTimezoneOffset(date);
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${timezoneOffset}`;
}

function formatTimezoneOffset(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = padDatePart(Math.floor(absoluteMinutes / 60));
  const minutes = padDatePart(absoluteMinutes % 60);
  return `${sign}${hours}:${minutes}`;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}
