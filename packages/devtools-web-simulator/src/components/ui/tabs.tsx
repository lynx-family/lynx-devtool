import * as React from 'react';
import { cn } from '../../lib/utils';

export interface TabsProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  items: { value: T; label: React.ReactNode }[];
  className?: string;
}

export function Tabs<T extends string>({ value, onValueChange, items, className }: TabsProps<T>) {
  return (
    <div className={cn('inline-flex h-9 items-center rounded-md border bg-muted/30 p-1 text-sm', className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            onClick={() => onValueChange(item.value)}
            className={cn(
              'inline-flex h-7 items-center rounded px-3 transition-colors',
              active ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}


