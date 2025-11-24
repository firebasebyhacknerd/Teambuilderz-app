import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

/**
 * Hook to register and manage Service Worker
 * Handles offline support, caching, and background sync
 */
export const useServiceWorker = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [swRegistration, setSwRegistration] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Register Service Worker
    const registerServiceWorker = async () => {
      try {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.register('/service-worker.js', {
            scope: '/',
          });

          console.log('[Service Worker] Registered successfully:', registration);
          setSwRegistration(registration);

          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
                toast.success('App update available! Refresh to update.', {
                  duration: 5000,
                  icon: '🔄',
                });
              }
            });
          });

          // Handle controller change
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('[Service Worker] Controller changed');
          });
        }
      } catch (error) {
        console.error('[Service Worker] Registration failed:', error);
      }
    };

    // Handle online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('You are back online!', { duration: 3000 });
      // Trigger sync
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.sync.register('sync-data');
        });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.error('You are offline. Some features may be limited.', { duration: 3000 });
    };

    // Register listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register Service Worker
    registerServiceWorker();

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update app
  const updateApp = () => {
    if (swRegistration?.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  // Clear cache
  const clearCache = async () => {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      toast.success('Cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      toast.error('Failed to clear cache');
    }
  };

  return {
    isOnline,
    updateAvailable,
    updateApp,
    clearCache,
    swRegistration,
  };
};

export default useServiceWorker;
