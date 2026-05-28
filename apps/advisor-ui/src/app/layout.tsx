// FILE: apps/advisor-ui/src/app/layout.tsx
// Ref: Blueprint §3.1 — React/Next.js frontend; Tailwind CSS design system

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Advisor AI — Intelligent Agent Platform',
  description:
    'AI-powered concierge for financial advisors — real-time portfolio insights, compliance supervision, and client intelligence.',
  keywords: ['financial advisor', 'AI assistant', 'portfolio management', 'compliance', 'wealth management'],
  robots: { index: false, follow: false }, // Internal enterprise tool
  icons: {
    icon: '/incedo_favicon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        {children}
      </body>
    </html>
  );
}
