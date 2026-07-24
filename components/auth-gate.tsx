"use client";

import type { Session } from "@supabase/supabase-js";
import { FormEvent, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./auth-gate.module.css";

type Profile = {
  id: string;
  email: string | null;
  display_name: string;
  department: string;
  role: "admin" | "manager" | "editor" | "viewer";
  active: boolean;
  organization_id: string | null;
  organization?: { name: string } | null;
};

type WorkspacePayload = {
  periods: unknown[];
  records: unknown[];
  factors: unknown[];
  evidence: unknown[];
  indicators: unknown[];
  targets: unknown[];
  plans: unknown[];
  audit: unknown[];
  criteria: Record<string, unknown>;
  noticePrefs: Record<string, unknown>;
  organizations: Record<string, unknown>;
};

const EMPTY_WORKSPACE: WorkspacePayload = {
  periods: [],
  records: [],
  factors: [],
  evidence: [],
  indicators: [],
  targets: [],
  plans: [],
  audit: [],
  criteria: {
    variance: 10,
    evidenceRequired: true,
    lockConfirmed: true,
    defaultYear: String(new Date().getFullYear()),
  },
  noticePrefs: {
    deadline: true,
    review: true,
    rejected: true,
    weekly: false,
  },
  organizations: {},
};

const STORAGE_KEYS: Record<keyof WorkspacePayload, string> = {
  periods: "sems2-periods",
  records: "sems2-records",
  factors: "sems2-factors",
  evidence: "sems2-evidence",
  indicators: "sems2-indicators",
  targets: "sems2-targets",
  plans: "sems2-reduction-plans",
  audit: "sems2-audit",
  criteria: "sems2-criteria",
  noticePrefs: "sems2-notice-prefs",
  organizations: "sems2-organizations",
};

function normalizeWorkspace(value: unknown): WorkspacePayload {
  const payload = value && typeof value === "object" ? value as Partial<WorkspacePayload> : {};
  return {
    periods: Array.isArray(payload.periods) ? payload.periods : [],
    records: Array.isArray(payload.records) ? payload.records : [],
    factors: Array.isArray(payload.factors) ? payload.factors : [],
    evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
    indicators: Array.isArray(payload.indicators) ? payload.indicators : [],
    targets: Array.isArray(payload.targets) ? payload.targets : [],
    plans: Array.isArray(payload.plans) ? payload.plans : [],
    audit: Array.isArray(payload.audit) ? payload.audit : [],
    criteria: payload.criteria && typeof payload.criteria === "object" ? payload.criteria : EMPTY_WORKSPACE.criteria,
    noticePrefs: payload.noticePrefs && typeof payload.noticePrefs === "object" ? payload.noticePrefs : EMPTY_WORKSPACE.noticePrefs,
    organizations: payload.organizations && typeof payload.organizations === "object" ? payload.organizations : {},
  };
}

function writeWorkspaceToBrowser(payload: WorkspacePayload) {
  for (const key of Object.keys(STORAGE_KEYS) as (keyof WorkspacePayload)[]) {
    window.localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(payload[key]));
  }
}

function readWorkspaceFromBrowser(): WorkspacePayload {
  const result = { ...EMPTY_WORKSPACE } as WorkspacePayload;

  for (const key of Object.keys(STORAGE_KEYS) as (keyof WorkspacePayload)[]) {
    const raw = window.localStorage.getItem(STORAGE_KEYS[key]);
    if (!raw) continue;
    try {
      result[key] = JSON.parse(raw) as never;
    } catch {
      result[key] = EMPTY_WORKSPACE[key] as never;
    }
  }

  return normalizeWorkspace(result);
}

function workspaceScope(profile: Profile) {
  if (profile.role === "admin" || profile.role === "manager") {
    return { scopeKey: "global", organizationId: null };
  }

  return {
    scopeKey: profile.organization_id ? `organization:${profile.organization_id}` : "",
    organizationId: profile.organization_id,
  };
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [appVisible, setAppVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const lastWorkspace = useRef("");
  const syncRunning = useRef(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadProfileAndWorkspace = async (currentSession: Session | null) => {
      if (!mounted) return;
      setSession(currentSession);
      setWorkspaceReady(false);
      setAppVisible(false);

      if (!currentSession) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id,email,display_name,department,role,active,organization_id,organization:organizations(name)")
        .eq("id", currentSession.user.id)
        .single();

      if (!mounted) return;

      if (profileError) {
        setError("사용자 권한 정보를 불러오지 못했습니다. Supabase 스키마 적용 여부를 확인해 주세요.");
        setProfile(null);
        setLoading(false);
        return;
      }

      const nextProfile = data as unknown as Profile;
      const { scopeKey } = workspaceScope(nextProfile);

      if (!scopeKey) {
        setError("사용자에게 소속 법인이 지정되지 않았습니다. 관리자에게 권한 설정을 요청해 주세요.");
        setProfile(nextProfile);
        setLoading(false);
        return;
      }

      const { data: workspace, error: workspaceError } = await supabase
        .from("workspace_states")
        .select("payload")
        .eq("scope_key", scopeKey)
        .maybeSingle();

      if (!mounted) return;

      if (workspaceError) {
        setError("공용 운영 데이터를 불러오지 못했습니다. workspace_states 마이그레이션 적용 여부를 확인해 주세요.");
        setProfile(nextProfile);
        setLoading(false);
        return;
      }

      const payload = normalizeWorkspace(workspace?.payload ?? EMPTY_WORKSPACE);
      writeWorkspaceToBrowser(payload);
      lastWorkspace.current = JSON.stringify(payload);
      setError("");
      setProfile(nextProfile);
      setWorkspaceReady(true);
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => loadProfileAndWorkspace(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setLoading(true);
      void loadProfileAndWorkspace(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!workspaceReady || !profile || !session || !supabase) return;

    const revealTimer = window.setTimeout(() => setAppVisible(true), 250);

    if (profile.role === "viewer") {
      return () => window.clearTimeout(revealTimer);
    }

    const { scopeKey, organizationId } = workspaceScope(profile);
    const syncTimer = window.setInterval(async () => {
      if (syncRunning.current) return;

      const payload = readWorkspaceFromBrowser();
      const serialized = JSON.stringify(payload);
      if (serialized === lastWorkspace.current) return;

      syncRunning.current = true;
      const { error: syncError } = await supabase
        .from("workspace_states")
        .upsert({
          scope_key: scopeKey,
          organization_id: organizationId,
          payload,
          updated_by: session.user.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "scope_key" });

      if (!syncError) {
        lastWorkspace.current = serialized;
      }
      syncRunning.current = false;
    }, 1800);

    return () => {
      window.clearTimeout(revealTimer);
      window.clearInterval(syncTimer);
    };
  }, [profile, session, supabase, workspaceReady]);

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

  if (!profile || !profile.active || !workspaceReady) {
    return (
      <main className={styles.screen}>
        <section className={styles.card}>
          <Brand />
          <h1>접근 권한을 확인해 주세요.</h1>
          <p className={styles.description}>
            로그인은 완료되었지만 SEMS 사용 권한 또는 운영 데이터 연결이 활성화되지 않았습니다.
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
      <div style={{ opacity: appVisible ? 1 : 0, pointerEvents: appVisible ? "auto" : "none", transition: "opacity 120ms ease" }}>
        {children}
      </div>
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
