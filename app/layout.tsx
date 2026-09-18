import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Swayam · స్వయం",
  description: "Your voice. Your language. Your independence. Source-backed everyday guidance in Telugu and English.",
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
