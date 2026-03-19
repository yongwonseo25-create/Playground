import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import '@/shared/styles/globals.css';

const geistSans = Inter({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap'
});

const interDisplay = Inter({
  subsets: ['latin'],
  variable: '--font-inter-display',
  display: 'swap'
});

const geistMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'VOXERA',
  description: 'Route your voice to anywhere. Instantly.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
      className={`dark ${geistSans.variable} ${interDisplay.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-background text-foreground">
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          theme="dark"
          toastOptions={{
            classNames: {
              toast: 'border border-stroke bg-bg-surface text-text-primary',
              description: 'text-text-secondary'
            }
          }}
        />
      </body>
    </html>
  );
}
