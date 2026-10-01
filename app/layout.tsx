import type { Metadata, Viewport } from "next";
import "./globals.css";

// Installable from the browser on a phone: the manifest and touch icon make
// "Add to Home Screen" open Accrue full screen, like an app, at Home.
export const metadata: Metadata = {
  title: "Accrue — Verified payments",
  description:
    "Fund the job. Agree on completion. Pay when the work is verified.",
  other: {
    "codex-preview": "development",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Accrue",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f0f12",
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
