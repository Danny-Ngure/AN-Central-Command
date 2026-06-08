import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Alfayo Nelson Central Command',
  description: 'Campaign intelligence portal — Alfayo Nelson, Nyali Constituency.',
  icons: { icon: '/logo.png' },
};

// Set the saved theme BEFORE first paint to avoid a light/dark flash.
// Default is light; users opt into dark via the toggle (persisted in localStorage).
const themeScript = `
(function(){try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
