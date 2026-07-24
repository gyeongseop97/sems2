import type { Metadata } from "next";
import AdminUserLink from "@/components/admin-user-link";
import AuthGate from "@/components/auth-gate";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "SEMS | Sewon ESG Management System",
  description: "세원그룹 ESG 데이터 수집 및 온실가스 관리 시스템",
  other: { "codex-preview": "development" },
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <AuthGate>
          <AdminUserLink />
          {children}
        </AuthGate>
      </body>
    </html>
  );
}
