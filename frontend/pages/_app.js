import '../styles/globals.css';
import Head from 'next/head';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
