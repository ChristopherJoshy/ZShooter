import type { Metadata } from 'next';
import { Quicksand, Cormorant_Garamond } from 'next/font/google';
import './globals.css';

const quicksand = Quicksand({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-quicksand',
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300'],
  style: ['italic', 'normal'],
  variable: '--font-cormorant',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ZShooter',
  description: 'A top-down shooter game. A game by Christopher Joshy.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${quicksand.variable} ${cormorant.variable}`}>
      <body>{children}</body>
    </html>
  );
}
