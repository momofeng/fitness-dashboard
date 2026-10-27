import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "健身日誌加密同步",
  description: "健身日誌的免帳號加密同步服務。",
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
    <html lang="zh-Hant-TW">
      <body className="antialiased">{children}</body>
    </html>
  );
}
