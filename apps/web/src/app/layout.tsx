import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: { default: 'BuildTrack', template: '%s · BuildTrack' },
  description: 'Follow the construction of your flat: progress, photos, payments and handover, in one place.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f3eee2' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
