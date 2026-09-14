import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Accrue — Verified payments",
  description:
    "Fund the job. Agree on completion. Pay when the work is verified.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

import Providers from "./providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
