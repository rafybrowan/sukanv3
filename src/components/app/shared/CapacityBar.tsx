'use client';

import { cn } from '@/lib/utils';

export function CapacityBar({
  filled, capacity, className, showLabel = false,
}: { filled: number; capacity: number; className?: string; showLabel?: boolean }) {
  const pct = capacity > 0 ? Math.min(100, Math.round((filled / capacity) * 100)) : 0;
  const color =
    pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-orange-500' : pct >= 50 ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span><b className="text-foreground">{filled}</b> / {capacity} peserta</span>
          <span>{pct}%</span>
        </div>
      )}
    </div>
  );
}

export function GroupCapacityPill({ current, ideal = 7 }: { current: number; ideal?: number }) {
  const complete = current >= ideal;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
      complete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
    )}>
      {current} / {ideal} peserta
    </span>
  );
}
