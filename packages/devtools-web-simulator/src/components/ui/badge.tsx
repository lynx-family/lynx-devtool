import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'blue' | 'green' | 'purple';
}

const map: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-muted text-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  outline: 'border border-input',
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  purple: 'bg-purple-100 text-purple-700',
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant = 'default', ...props }, ref) => (
  <span ref={ref} className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', map[variant], className)} {...props} />
));
Badge.displayName = 'Badge';


