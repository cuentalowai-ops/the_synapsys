/**
 * the_synapsys Website - Root Layout
 *
 * EUDI Wallet Relying Party Landing Page
 * Supports dark/light theme switching
 */

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "the_synapsys - EUDI Wallet Relying Party",
  description:
    "European Digital Identity Wallet Relying Party verification service. eIDAS 2.0, ISO 27001, and GDPR compliant infrastructure.",
  keywords: [
    "EUDI",
    "wallet",
    "eIDAS",
    "digital identity",
    "relying party",
    "verification",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
