import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { addListener, flushAnalytics, getAnalyticsState } from '../../lib/analytics';
import { Button } from '../ui/button';

const STATUS_CLASS_MAP = {
  idle: 'bg-secondary',
  queued: 'bg-amber-400 animate-pulse',
  flushing: 'bg-primary animate-pulse',
  success: 'bg-primary',
  error: 'bg-destructive animate-pulse',
};

const STATUS_ICON = {
  idle: null,
  queued: null,
  flushing: null,
  success: <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />,
  error: <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />,
};

export default function ActivityPulse() {
  const initialState = useMemo(() => getAnalyticsState(), []);
  const [queueSize, setQueueSize] = useState(initialState.queueSize ?? 0);
  const [isFlushing, setIsFlushing] = useState(initialState.isFlushing ?? false);
  const [lastFlushAt, setLastFlushAt] = useState(initialState.lastFlushAt ?? null);
  const [lastErrorMessage, setLastErrorMessage] = useState(initialState.lastError?.message ?? null);
  const [status, setStatus] = useState(queueSize > 0 ? 'queued' : 'idle');

  useEffect(() => {
    const unsubscribe = addListener((event) => {
      setQueueSize(event.queueSize ?? 0);
      setIsFlushing(Boolean(event.isFlushing));
      setLastFlushAt(event.lastFlushAt ?? null);
      setLastErrorMessage(event.lastError?.message ?? null);

      if (event.type === 'queued') {
        setStatus('queued');
      } else if (event.type === 'flush:start') {
        setStatus('flushing');
      } else if (event.type === 'flush:success') {
        setStatus('success');
      } else if (event.type === 'flush:error') {
        setStatus('error');
      } else if (event.queueSize === 0 && !event.isFlushing) {
        setStatus('idle');
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (status === 'success' || status === 'error') {
      const timer = setTimeout(() => setStatus(queueSize > 0 ? 'queued' : 'idle'), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status, queueSize]);

  const formattedFlushTime = useMemo(() => {
    if (!lastFlushAt) return 'Awaiting first sync';
    try {
      return `Updated ${new Date(lastFlushAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } catch (err) {
      return `Updated recently`;
    }
  }, [lastFlushAt]);

  const helperText = useMemo(() => {
    if (status === 'error' && lastErrorMessage) {
      return lastErrorMessage;
    }
    if (queueSize > 0 && status !== 'flushing') {
      return `${queueSize} event${queueSize === 1 ? '' : 's'} queued`;
    }
    return formattedFlushTime;
  }, [status, lastErrorMessage, queueSize, formattedFlushTime]);

  const statusLabel = useMemo(() => {
    if (status === 'error') return 'Sync issue';
    if (isFlushing || status === 'flushing') return 'Syncing analytics';
    if (status === 'queued') return 'Pulse active';
    if (status === 'success') return 'Analytics synced';
    return 'Activity pulse';
  }, [status, isFlushing]);

  const barClass = STATUS_CLASS_MAP[status] ?? STATUS_CLASS_MAP.idle;
  const widthPercent = isFlushing || queueSize > 0 ? '100%' : '40%';

  return (
    <div className="flex items-center gap-3 rounded-full border border-border/70 bg-card/80 px-3 py-1.5 shadow-sm">
      <div className="relative h-2 w-20 overflow-hidden rounded-full bg-muted">
        <div
          className={`absolute inset-y-0 left-0 transition-all duration-500 ease-out ${barClass}`}
          style={{ width: widthPercent }}
        />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {STATUS_ICON[status]}
          {statusLabel}
        </span>
        <span className="text-[10px] text-muted-foreground/80">{helperText}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={() => flushAnalytics('manual')}
        title="Flush analytics now"
        type="button"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isFlushing ? 'animate-spin' : ''}`} />
        <span className="sr-only">Flush analytics</span>
      </Button>
    </div>
  );
}
