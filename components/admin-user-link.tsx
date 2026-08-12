"use client";

import Link from "next/link";

import { useSemsAuth } from "@/components/auth-context";

export default function AdminUserLink() {
  const { isAdmin } = useSemsAuth();
  if (!isAdmin) return null;

  return (
    <Link
      href="/admin/users"
      style={{
        position: "fixed",
        right: 18,
        bottom: 72,
        zIndex: 81,
        display: "inline-flex",
        alignItems: "center",
        height: 38,
        padding: "0 14px",
        border: "1px solid rgba(29,66,54,.14)",
        borderRadius: 11,
        background: "rgba(255,255,255,.96)",
        boxShadow: "0 9px 26px rgba(24,59,48,.12)",
        color: "#245545",
        fontSize: 12,
        fontWeight: 800,
        textDecoration: "none",
      }}
    >
      사용자 관리
    </Link>
  );
}
