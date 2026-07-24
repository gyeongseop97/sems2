"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AdminUserLink() {
  const supabase = getSupabaseBrowserClient();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) return;
      const { data: profile } = await supabase.from("profiles").select("role,active").eq("id", userId).single();
      if (mounted) setVisible(Boolean(profile?.active && profile.role === "admin"));
    };

    void check();
    return () => { mounted = false; };
  }, [supabase]);

  if (!visible) return null;

  return (
    <a
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
    </a>
  );
}
