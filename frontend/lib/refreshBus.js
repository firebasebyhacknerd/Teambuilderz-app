import { useEffect } from 'react';

const channels = new Map();

export const emitRefresh = (channel, payload) => {
  const handlers = channels.get(channel);
  if (!handlers || handlers.size === 0) {
    return;
  }
  handlers.forEach((handler) => {
    try {
      handler(payload);
    } catch (error) {
      console.error(`Refresh handler for channel "${channel}" failed:`, error);
    }
  });
};

export const useRefreshListener = (channel, handler) => {
  useEffect(() => {
    if (!channel || typeof handler !== 'function') {
      return undefined;
    }

    let listeners = channels.get(channel);
    if (!listeners) {
      listeners = new Set();
      channels.set(channel, listeners);
    }

    listeners.add(handler);

    return () => {
      listeners.delete(handler);
      if (listeners.size === 0) {
        channels.delete(channel);
      }
    };
  }, [channel, handler]);
};

export const REFRESH_CHANNELS = Object.freeze({
  ALERTS: 'alerts',
  ATTENDANCE: 'attendance',
  CANDIDATES: 'candidates',
  DASHBOARD: 'dashboard',
  PERFORMANCE: 'performance',
  PROFILE: 'profile',
});

