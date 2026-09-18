import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Thodu · తోడు",
  description: "Everyday tasks, one step at a time. Telugu voice guidance with official sources.",
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
    <html lang="te">
      <body className="antialiased">{children}</body>
    </html>
  );
}
