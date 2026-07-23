import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEMS | Sewon ESG Management System",
  description: "세원그룹 ESG 데이터 수집 및 온실가스 관리 시스템",
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
