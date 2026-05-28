import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AN Central Command',
  description: 'Campaign intelligence portal — Alfayo Nelson, Nyali Constituency.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
