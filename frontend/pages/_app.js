import '../styles/globals.css';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureAnalytics, flushAnalytics, track } from '../lib/analytics';
import API_URL from '../lib/api';

function MyApp({ Component, pageProps }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 1000 * 60, // 1 minute
            retry: 1,
          },
          mutations: {
            retry: 1,
          },
        },
      }),
  );
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
      return;
    }

    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      const nextInit = {
        credentials: 'include',
        ...init,
      };
      return originalFetch(input, nextInit);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    configureAnalytics({
      endpoint: `${API_URL}/api/v1/analytics`,
      flushInterval: 15000,
      maxBatchSize: 25,
    });

    if (typeof document !== 'undefined') {
      const handleVisibility = () => {
        if (document.visibilityState === 'hidden') {
          flushAnalytics('visibility');
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }

    return undefined;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleBeforeUnload = () => flushAnalytics('beforeunload');
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    track('page_view', {
      path: router.asPath,
    });
  }, [router.asPath, router.isReady]);

  return (
    <>
      <Head>
        <title>Staffing Architect - TeamBuilderz LLC</title>
        <meta name="description" content="TeamBuilderz LLC Internal Access Portal" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
      </QueryClientProvider>
    </>
  );
}

export default MyApp;


