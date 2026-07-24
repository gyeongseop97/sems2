"use client";

import type { Session } from "@supabase/supabase-js";
import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./auth-gate.module.css";

type Profile = {
  id: string;
  email: string | null;
  display_name: string;
  department: string;
  role: "admin" | "manager" | "editor" | "viewer";
  active: boolean;
  organization?: { name: string } | null;
};

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadProfile = async (currentSession: Session | null) => {
      if (!mounted) return;
      setSession(currentSession);

      if (!currentSession) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id,email,display_name,department,role,active,organization:organizations(name)")
        .eq("id", currentSession.user.id)
        .single();

      if (!mounted) return;

      if (profileError) {
        setError("사용자 권한 정보를 불러오지 못했습니다. Supabase 스키마 적용 여부를 확인해 주세요.");
        setProfile(null);
      } else {
        setError("");
        setProfile(data as unknown as Profile);
      }

      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => loadProfile(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setLoading(true);
      void loadProfile(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;

    setSubmitting(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError("이메일 또는 비밀번호를 확인해 주세요.");
      setSubmitting(false);
      return;
    }

    setPassword("");
    setSubmitting(false);
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <main className={styles.screen}>
        <div className={styles.loading}>
          <span className={styles.spinner} />
          <span>SEMS 사용자 정보를 확인하고 있습니다.</span>
        </div>
      </main>
    );
  }

  if (!supabase) {
    return (
      <main className={styles.screen}>
        <section className={styles.card}>
          <Brand />
          <h1>Supabase 연결이 필요합니다.</h1>
          <p className={styles.description}>
            Vercel 프로젝트에 환경변수를 등록하면 로그인 화면이 활성화됩니다.
          </p>
          <p className={styles.error}>
            NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다.
          </p>
          <p className={styles.note}>비밀키가 아닌 Supabase Project URL과 Publishable/Anon Key만 등록합니다.</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className={styles.screen}>
        <section className={styles.card}>
          <Brand />
          <h1>SEMS 로그인</h1>
          <p className={styles.description}>등록된 회사 계정으로 로그인해 주세요.</p>
          <form className={styles.form} onSubmit={signIn}>
            <label className={styles.field}>
              이메일
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@se-won.co.kr"
                required
              />
            </label>
            <label className={styles.field}>
              비밀번호
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="비밀번호 입력"
                required
              />
            </label>
            {error && <p className={styles.error}>{error}</p>}
            <button className={styles.button} type="submit" disabled={submitting}>
              {submitting ? "로그인 중..." : "로그인"}
            </button>
          </form>
          <p className={styles.note}>계정 생성과 권한 부여는 SEMS 관리자만 수행합니다.</p>
        </section>
      </main>
    );
  }

  if (!profile || !profile.active) {
    return (
      <main className={styles.screen}>
        <section className={styles.card}>
          <Brand />
          <h1>접근 권한을 확인해 주세요.</h1>
          <p className={styles.description}>
            로그인은 완료되었지만 SEMS 사용 권한이 활성화되지 않았습니다.
          </p>
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.secondaryButton} type="button" onClick={signOut}>
            로그아웃
          </button>
        </section>
      </main>
    );
  }

  const roleLabel = {
    admin: "관리자",
    manager: "기획실 관리자",
    editor: "자료 입력자",
    viewer: "조회자",
  }[profile.role];

  return (
    <>
      {children}
      <div className={styles.session} aria-label="현재 로그인 정보">
        <div className={styles.sessionText}>
          <strong>{profile.display_name || profile.email}</strong>
          <span>{profile.organization?.name ?? "전체 법인"} · {roleLabel}</span>
        </div>
        <button className={styles.logout} type="button" onClick={signOut}>로그아웃</button>
      </div>
    </>
  );
}

function Brand() {
  return (
    <div className={styles.brand}>
      <div className={styles.mark}>S</div>
      <div>
        <strong>SEMS</strong>
        <span>Sewon ESG Management System</span>
      </div>
    </div>
  );
}
