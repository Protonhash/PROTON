import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PROTON - AI Compute Mining for Solana',
  description: 'Decentralized AI compute mining platform. Mine with your CPU/GPU, earn PROTON rewards.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-proton-darker antialiased">
        {children}
      </body>
    </html>
  );
}
