import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import '@/shared/styles/globals.css';

export const metadata: Metadata = {
  title: 'Voxera',
  description: 'Voxera Listen-Think-Act front-end foundation'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
