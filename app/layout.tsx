import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "技能面板",
  description: "本地技能管理、检索和调用面板。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
