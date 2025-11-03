let config = {
  endpoint: '/api/v1/analytics',
  flushInterval: 15000,
  maxBatchSize: 20,
  storageKey: 'tbz.analytics.queue',
};

const listeners = [];
let queue = [];
let flushTimer = null;
let isFlushing = false;
let lastFlushAt = null;
let lastError = null;

function canUseWindow() {
  return typeof window !== 'undefined';
}

function canUseStorage() {
  return canUseWindow() && typeof window.localStorage !== 'undefined';
}

function notify(type, detail = {}) {
  const payload = { type, ...detail, queueSize: queue.length, lastFlushAt, lastError, isFlushing };
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (err) {
      console.error('[Analytics] listener error', err);
    }
  });
}

function persistQueue() {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(config.storageKey, JSON.stringify(queue));
  } catch (err) {
    console.warn('[Analytics] Failed to persist queue', err);
  }
}

function loadQueue() {
  if (!canUseStorage()) return;
  try {
    const raw = window.localStorage.getItem(config.storageKey);
    if (!raw) return;
    const restored = JSON.parse(raw);
    if (Array.isArray(restored)) {
      queue = restored;
    }
  } catch (err) {
    console.warn('[Analytics] Failed to restore queue', err);
  }
}

loadQueue();

function scheduleFlush(delay) {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const interval = typeof delay === 'number' ? delay : config.flushInterval;
  if (!interval || interval <= 0) return;
  if (queue.length === 0) return;

  flushTimer = setTimeout(() => {
    flushAnalytics('timer');
  }, interval);
}

function getAuthHeaders() {
  if (!canUseStorage()) return {};
  const token = window.localStorage.getItem('token');
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function sendBatch(batch) {
  if (!batch.length) return;

  if (typeof fetch !== 'function') {
    console.info('[Analytics] batch (no fetch available)', batch);
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  };

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ events: batch }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Flush failed (status ${response.status}): ${text}`);
  }
}

export function configureAnalytics(options = {}) {
  config = { ...config, ...options };
  scheduleFlush();
}

export function addListener(listener) {
  if (typeof listener === 'function') {
    listeners.push(listener);
  }
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) {
      listeners.splice(idx, 1);
    }
  };
}

export function getQueueSize() {
  return queue.length;
}

export function getLastFlush() {
  return lastFlushAt;
}

export function getAnalyticsState() {
  return {
    queueSize: queue.length,
    lastFlushAt,
    lastError,
    isFlushing,
  };
}

export function track(event, payload = {}, options = {}) {
  const entry = {
    id: options.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    event,
    payload,
    timestamp: Date.now(),
  };

  queue.push(entry);
  persistQueue();
  notify('queued', { entry });

  if (queue.length >= config.maxBatchSize) {
    flushAnalytics('threshold');
  } else {
    scheduleFlush();
  }
}

export async function flushAnalytics(reason = 'manual') {
  if (isFlushing) return;
  if (queue.length === 0) return;

  isFlushing = true;
  notify('flush:start', { reason, batchSize: Math.min(queue.length, config.maxBatchSize) });

  const batch = queue.slice(0, config.maxBatchSize);

  try {
    await sendBatch(batch);
    queue = queue.slice(batch.length);
    persistQueue();
    lastFlushAt = Date.now();
    lastError = null;
    notify('flush:success', { reason, count: batch.length });

    if (queue.length > 0) {
      scheduleFlush(500);
    }
  } catch (error) {
    lastError = error instanceof Error ? error : new Error(String(error));
    notify('flush:error', { reason, error: lastError.message });
    scheduleFlush(Math.min(config.flushInterval || 10000, 5000));
  } finally {
    isFlushing = false;
  }
}

if (queue.length > 0 && config.flushInterval > 0) {
  scheduleFlush();
}
