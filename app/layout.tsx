import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { BTCPensionProviderV3 } from './components/providers/BTCPensionProviderV3';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Bitcoin Pension Calculator',
  description: 'Bitcoin Pension & Passive-Income Planner',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <BTCPensionProviderV3>{children}</BTCPensionProviderV3>
      </body>
    </html>
  );
}
