'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { ToastProvider } from './toast';
import { PaymentModalProvider } from './payment-modal';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <PaymentModalProvider>
          {children}
        </PaymentModalProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
