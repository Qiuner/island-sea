import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MVP Clarifier · 想法明确工具",
  description: "用 AI 把模糊想法收敛为可开发的 MVP。",
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
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
