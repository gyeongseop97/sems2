"use client";

import type { Session } from "@supabase/supabase-js";
import { FormEvent, useEffect, useRef, useState } from "react";

import {
  AuthContext,
  type SemsProfile,
  type SyncStatus,
  WORKSPACE_CHANGE_EVENT,
} from "@/components/auth-context";
import { DEFAULT_EMISSION_FACTORS, withDefaultEmissionFactors } from "@/lib/emission-factor-library";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import styles from "./auth-gate.module.css";

type WorkspacePayload = {
  periods: unknown[];
  records: unknown[];
  factors: unknown[];
  evidence: unknown[];
  indicators: unknown[];
  metricRequests: unknown[];
  metricSubmissions: unknown[];
  reports: unknown[];
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
  factors: DEFAULT_EMISSION_FACTORS,
  evidence: [],
  indicators: [],
  metricRequests: [],
  metricSubmissions: [],
  reports: [],
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
  metricRequests: "sems2-metric-requests",
  metricSubmissions: "sems2-metric-submissions",
  reports: "sems2-reports",
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
    factors: withDefaultEmissionFactors(Array.isArray(payload.factors) ? payload.factors : []),
    evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
    indicators: Array.isArray(payload.indicators) ? payload.indicators : [],
    metricRequests: Array.isArray(payload.metricRequests) ? payload.metricRequests : [],
    metricSubmissions: Array.isArray(payload.metricSubmissions) ? payload.metricSubmissions : [],
    reports: Array.isArray(payload.reports) ? payload.reports : [],
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

async function fetchWorkspace(session: Session) {
  const response = await fetch("/api/workspace", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "운영 데이터를 불러오지 못했습니다.");
  }
  return payload as { profile: SemsProfile; payload: WorkspacePayload };
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<SemsProfile | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("saved");
  const lastWorkspace = useRef("");
  const syncRunning = useRef(false);
  const syncQueued = useRef(false);

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    const load = async (currentSession: Session | null) => {
      if (!mounted) return;
      setSession(currentSession);
      setWorkspaceReady(false);
      setSyncStatus("saved");

      if (!currentSession) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const result = await fetchWorkspace(currentSession);
        if (!mounted) return;
        const workspace = normalizeWorkspace(result.payload);
        writeWorkspaceToBrowser(workspace);
        lastWorkspace.current = JSON.stringify(workspace);
        setProfile(result.profile);
        setError("");
        setWorkspaceReady(true);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "사용자 권한과 운영 데이터를 불러오지 못했습니다.");
        setProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setLoading(true);
      void load(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!workspaceReady || !profile || !session || profile.role === "viewer") return;

    const sync = async () => {
      if (syncRunning.current) {
        syncQueued.current = true;
        return;
      }

      const payload = readWorkspaceFromBrowser();
      const serialized = JSON.stringify(payload);
      if (serialized === lastWorkspace.current) {
        setSyncStatus("saved");
        return;
      }

      syncRunning.current = true;
      setSyncStatus("saving");
      try {
        const response = await fetch("/api/workspace", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ payload }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "서버 저장에 실패했습니다.");
        lastWorkspace.current = serialized;
        setSyncStatus("saved");
      } catch {
        setSyncStatus("error");
      } finally {
        syncRunning.current = false;
        if (syncQueued.current) {
          syncQueued.current = false;
          void sync();
        }
      }
    };

    let debounceTimer = 0;
    const scheduleSync = () => {
      setSyncStatus("saving");
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => void sync(), 450);
    };
    const safetyTimer = window.setInterval(() => void sync(), 15000);
    window.addEventListener(WORKSPACE_CHANGE_EVENT, scheduleSync);

    return () => {
      window.clearTimeout(debounceTimer);
      window.clearInterval(safetyTimer);
      window.removeEventListener(WORKSPACE_CHANGE_EVENT, scheduleSync);
    };
  }, [profile, session, workspaceReady]);

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
          <span>SEMS 사용자 정보와 운영 데이터를 불러오고 있습니다.</span>
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
          <p className={styles.description}>Vercel 프로젝트에 환경변수를 등록하면 로그인 화면이 활성화됩니다.</p>
          <p className={styles.error}>NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다.</p>
          <p className={styles.note}>비밀키가 아닌 Supabase Project URL과 Publishable/Anon Key만 브라우저에 사용합니다.</p>
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
          <p className={styles.description}>관리자가 등록한 회사 계정으로 로그인해 주세요.</p>
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
          <p className={styles.note}>계정 생성과 법인·사업장 권한 부여는 SEMS 관리자만 수행합니다.</p>
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
          <p className={styles.description}>로그인은 완료되었지만 SEMS 사용 권한 또는 서버 데이터 연결이 활성화되지 않았습니다.</p>
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.secondaryButton} type="button" onClick={signOut}>로그아웃</button>
        </section>
      </main>
    );
  }

  const isAdmin = profile.role === "admin";
  const canManage = profile.role === "admin" || profile.role === "manager";
  const canWrite = profile.role !== "viewer";
  const contextValue = {
    profile,
    syncStatus,
    canWrite,
    canReview: canManage,
    canManage,
    isAdmin,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
      <button className={styles.session} type="button" onClick={signOut} aria-label="로그아웃">
        <div className={styles.sessionText}>
          <strong>{profile.display_name || profile.email}</strong>
          <span>{profile.organization?.name ?? "전체 법인"} · 로그아웃</span>
        </div>
      </button>
    </AuthContext.Provider>
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
