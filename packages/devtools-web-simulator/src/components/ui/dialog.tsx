import * as React from 'react';
import { cn } from '../../lib/utils';

export interface DialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  width?: number | string;
}

export function Dialog({ open, onOpenChange, title, children, width = 720 }: DialogProps) {
  const onBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onOpenChange?.(false);
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onBackdrop}>
      <div className={cn('rounded-lg border bg-background shadow-xl')} style={{ width }}>
        {title ? (
          <div className="border-b p-4 text-lg font-semibold">{title}</div>
        ) : null}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}


