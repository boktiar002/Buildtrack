'use client';

import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { ApiError } from '@/lib/api';
import { ToastProvider } from './ui';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (err) => {
            // Session ended in another tab or expired: go back to sign in.
            if (err instanceof ApiError && err.status === 401 && typeof window !== 'undefined' && !location.pathname.startsWith('/login')) {
              location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
            }
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            refetchOnWindowFocus: true,
            // Retry only problems that may go away (network, server busy), never "not found" or "no access".
            retry: (count, err) => err instanceof ApiError && (err.status === 0 || err.status >= 500 || err.status === 429) && count < 2,
            retryDelay: (n) => Math.min(1000 * 2 ** n, 8000),
          },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
