import * as React from 'react';
import { cn } from '../../lib/utils';

export type Column<T> = {
  key: string;
  title: React.ReactNode;
  width?: number | string;
  render?: (record: T) => React.ReactNode;
};

export interface TableProps<T> {
  data: T[];
  rowKey: (record: T) => string;
  columns: Column<T>[];
  className?: string;
}

export function Table<T>({ data, rowKey, columns, className }: TableProps<T>) {
  return (
    <div className={cn('w-full overflow-x-auto rounded-md border', className)}>
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ width: col.width }} className="px-3 py-2 text-left font-medium text-muted-foreground">
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((record) => (
            <tr key={rowKey(record)} className="border-t">
              {columns.map((col) => (
                <td key={col.key} style={{ width: col.width }} className="px-3 py-2 align-top">
                  {col.render ? col.render(record) : (record as any)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


