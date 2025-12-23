import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Synapsys Dashboard - EUDI Wallet RP',
  description: 'Dashboard for managing EUDI Wallet verification sessions',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
