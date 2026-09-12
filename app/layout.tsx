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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Inter carries the interface text and Silkscreen stands in for the
            pixel display face; the brand's own fonts are not redistributable.
            The rule below is a pages-router warning about per-page fonts; this
            is the app-router root layout, so the link applies to every page. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Silkscreen:wght@400;700&display=swap"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
