"use client";

import { WorkspaceSessionGuard } from "@/lib/workspace-session";
import type { WorkspaceRevisions } from "@/lib/workspace-integrity";
import type { Session } from "@supabase/supabase-js";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import {
  AuthContext,
  type SemsProfile,
  type SyncStatus,
  WORKSPACE_CHANGE_EVENT,
} from "@/components/auth-context";
import { canWriteRequestedData, isAdminRole } from "@/lib/access-control";
import { DEFAULT_EMISSION_FACTORS, withDefaultEmissionFactors } from "@/lib/emission-factor-library";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import styles from "./auth-gate.module.css";

type WorkspacePayload = {
  periods: unknown[];
  records: unknown[];
  factors: unknown[];
  formulas: unknown[];
  activityMasters: unknown[];
  assetUnits: unknown[];
  scope3Fields: unknown[];
  disclosureStandards: unknown[];
  regulations: unknown[];
  suppliers: unknown[];
  productMaterials: unknown[];
  transportRoutes: unknown[];
  disclosureMappings: unknown[];
  scope3Requests: unknown[];
  diagnosticTemplates: unknown[];
  supplyChainAssessments: unknown[];
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
  formulas: [],
  activityMasters: [],
  assetUnits: [],
  scope3Fields: [],
  disclosureStandards: [],
  regulations: [],
  suppliers: [],
  productMaterials: [],
  transportRoutes: [],
  disclosureMappings: [],
  scope3Requests: [],
  diagnosticTemplates: [],
  supplyChainAssessments: [],
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
  formulas: "sems2-formulas",
  activityMasters: "sems2-activity-masters",
  assetUnits: "sems2-asset-units",
  scope3Fields: "sems2-scope3-fields",
  disclosureStandards: "sems2-disclosure-standards",
  regulations: "sems2-regulations",
  suppliers: "sems2-suppliers",
  productMaterials: "sems2-product-materials",
  transportRoutes: "sems2-transport-routes",
  disclosureMappings: "sems2-disclosure-mappings",
  scope3Requests: "sems2-scope3-requests",
  diagnosticTemplates: "sems2-diagnostic-templates",
  supplyChainAssessments: "sems2-supply-chain-assessments",
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
    formulas: Array.isArray(payload.formulas) ? payload.formulas : [],
    activityMasters: Array.isArray(payload.activityMasters) ? payload.activityMasters : [],
    assetUnits: Array.isArray(payload.assetUnits) ? payload.assetUnits : [],
    scope3Fields: Array.isArray(payload.scope3Fields) ? payload.scope3Fields : [],
    disclosureStandards: Array.isArray(payload.disclosureStandards) ? payload.disclosureStandards : [],
    regulations: Array.isArray(payload.regulations) ? payload.regulations : [],
    suppliers: Array.isArray(payload.suppliers) ? payload.suppliers : [],
    productMaterials: Array.isArray(payload.productMaterials) ? payload.productMaterials : [],
    transportRoutes: Array.isArray(payload.transportRoutes) ? payload.transportRoutes : [],
    disclosureMappings: Array.isArray(payload.disclosureMappings) ? payload.disclosureMappings : [],
    scope3Requests: Array.isArray(payload.scope3Requests) ? payload.scope3Requests : [],
    diagnosticTemplates: Array.isArray(payload.diagnosticTemplates) ? payload.diagnosticTemplates : [],
    supplyChainAssessments: Array.isArray(payload.supplyChainAssessments) ? payload.supplyChainAssessments : [],
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
  return payload as { profile: SemsProfile; payload: WorkspacePayload; revisions: WorkspaceRevisions };
}

const draftKey = (userId: string) => `sems2-unsaved:${userId}`;

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
  const [syncError, setSyncError] = useState("");
  const [workspaceVersion, setWorkspaceVersion] = useState(0);
  const [reloading, setReloading] = useState(false);
  const loadGuard = useRef(new WorkspaceSessionGuard());
  const revisions = useRef<WorkspaceRevisions>({});
  const activeUser = useRef<string | null>(null);
  const draftWorkspace = useRef<WorkspacePayload | null>(null);
  const conflict = useRef(false);
  const syncRunning = useRef(false);
  const retry = useRef<() => void>(() => {});
  const pendingSave = useRef<{ payload: WorkspacePayload; serialized: string; revisions: WorkspaceRevisions; mutationId: string } | null>(null);
  const preserveDraft = useCallback((userId: string) => {
    if (!draftWorkspace.current) return;
    try {
      const serialized = JSON.stringify(draftWorkspace.current);
      if (serialized === lastWorkspace.current) window.sessionStorage.removeItem(draftKey(userId));
      else window.sessionStorage.setItem(draftKey(userId), JSON.stringify({ payload: draftWorkspace.current, revisions: revisions.current }));
    } catch { /* beforeunload still warns if browser storage is unavailable */ }
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;
    let loadedUserId: string | null = null;

    const load = async (currentSession: Session | null) => {
      if (!mounted) return;
      const loadStamp = loadGuard.current.begin(currentSession?.user.id ?? null);
      activeUser.current = currentSession?.user.id ?? null;
      setReloading(false);
      setSession(currentSession);
      setWorkspaceReady(false);
      setSyncStatus("saved");

      if (!currentSession) {
        setProfile(null);
        setLoading(false);
        loadGuard.current.finish(loadStamp);
        return;
      }

      try {
        const result = await fetchWorkspace(currentSession);
        if (!mounted || !loadGuard.current.isCurrent(loadStamp)) return;
        const workspace = normalizeWorkspace(result.payload);
        revisions.current = result.revisions;
        lastWorkspace.current = JSON.stringify(workspace);
        draftWorkspace.current = workspace;
        conflict.current = false;
        pendingSave.current = null;
        const recovery = window.sessionStorage.getItem(draftKey(currentSession.user.id));
        if (recovery) {
          try {
            const recovered = JSON.parse(recovery) as { payload: WorkspacePayload; revisions: WorkspaceRevisions };
            if (JSON.stringify(normalizeWorkspace(recovered.payload)) !== lastWorkspace.current) {
              draftWorkspace.current = normalizeWorkspace(recovered.payload);
              revisions.current = recovered.revisions;
              conflict.current = true;
              setSyncStatus("conflict");
              setSyncError("이 탭에 서버 저장이 확인되지 않은 변경사항이 남아 있습니다. 변경사항을 내려받아 보관한 후 최신 자료를 불러와 주세요.");
            } else window.sessionStorage.removeItem(draftKey(currentSession.user.id));
          } catch { window.sessionStorage.removeItem(draftKey(currentSession.user.id)); }
        }
        writeWorkspaceToBrowser(draftWorkspace.current);
        loadedUserId = currentSession.user.id;
        setProfile(result.profile);
        setError("");
        setWorkspaceReady(true);
      } catch (loadError) {
        if (!mounted || !loadGuard.current.isCurrent(loadStamp)) return;
        setError(loadError instanceof Error ? loadError.message : "사용자 권한과 운영 데이터를 불러오지 못했습니다.");
        setProfile(null);
      } finally {
        if (mounted && loadGuard.current.finish(loadStamp)) setLoading(false);
      }
    };

    const initialSessionStamp = loadGuard.current.capture();
    void supabase.auth.getSession().then(({ data }) => {
      if (loadGuard.current.isCurrent(initialSessionStamp)) return load(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Supabase can emit SIGNED_IN again when a background tab is restored and
      // TOKEN_REFRESHED whenever the access token rotates. Re-loading the whole
      // workspace for those routine events unmounted the editor and looked like
      // a page refresh. Keep the refreshed session without replacing the UI.
      if (event === "INITIAL_SESSION") return;
      if (event === "TOKEN_REFRESHED" && nextSession?.user.id !== activeUser.current) return;
      if (event === "TOKEN_REFRESHED" || (event === "SIGNED_IN" && nextSession?.user.id === loadedUserId)) {
        setSession(nextSession);
        return;
      }
      if (!nextSession) loadedUserId = null;
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
    let active = true;
    let debounceTimer = 0;
    const sync = async () => {
      if (syncRunning.current || conflict.current || !draftWorkspace.current || !loadGuard.current.canSave(session.user.id)) return;
      const serialized = JSON.stringify(draftWorkspace.current);
      if (serialized === lastWorkspace.current && !pendingSave.current) { setSyncStatus("saved"); return; }
      if (!pendingSave.current) pendingSave.current = { payload: draftWorkspace.current, serialized, revisions: { ...revisions.current }, mutationId: crypto.randomUUID() };
      const pending = pendingSave.current;
      const saveStamp = loadGuard.current.capture();
      syncRunning.current = true;
      setSyncStatus("saving");
      try {
        const response = await fetch("/api/workspace", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ payload: pending.payload, revisions: pending.revisions, mutationId: pending.mutationId }),
        });
        const result = await response.json();
        if (activeUser.current !== session.user.id || !loadGuard.current.isCurrent(saveStamp)) return;
        if (response.status === 409) {
          conflict.current = true;
          setSyncStatus("conflict");
          setSyncError(result.error ?? "다른 사용자의 변경사항이 있습니다. 최신 자료를 확인해 주세요.");
          return;
        }
        if (!response.ok) {
          // A definitive validation error can be fixed locally. An uncertain
          // network/5xx response retries the same receipt ID to avoid duplicates.
          if (response.status < 500) pendingSave.current = null;
          throw new Error(result.error ?? "서버 저장에 실패했습니다.");
        }
        if (!result.revisions || !result.savedAt) throw new Error("서버의 저장 확인을 받지 못했습니다. 다시 저장해 주세요.");
        revisions.current = result.revisions;
        lastWorkspace.current = pending.serialized;
        pendingSave.current = null;
        preserveDraft(session.user.id);
        if (!conflict.current) setSyncError("");
        setSyncStatus(conflict.current ? "conflict" : JSON.stringify(draftWorkspace.current) === lastWorkspace.current ? "saved" : "saving");
      } catch (saveError) {
        if (activeUser.current !== session.user.id || !loadGuard.current.isCurrent(saveStamp)) return;
        if (!conflict.current) {
          setSyncStatus("error");
          setSyncError(saveError instanceof Error ? saveError.message : "서버 저장에 실패했습니다.");
        }
      } finally {
        syncRunning.current = false;
        if (active && loadGuard.current.isCurrent(saveStamp) && activeUser.current === session.user.id && !conflict.current && !pendingSave.current && JSON.stringify(draftWorkspace.current) !== lastWorkspace.current) {
          // Validation failures wait for an edit or explicit retry; successful
          // requests with newer edits queued by the user are sent immediately.
          if (lastWorkspace.current === pending.serialized) debounceTimer = window.setTimeout(() => void sync(), 0);
        }
      }
    };
    const scheduleSync = () => {
      if (conflict.current || !loadGuard.current.canSave(session.user.id)) return;
      draftWorkspace.current = readWorkspaceFromBrowser();
      preserveDraft(session.user.id);
      if (JSON.stringify(draftWorkspace.current) === lastWorkspace.current && !pendingSave.current) return;
      setSyncStatus("saving");
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => void sync(), 450);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(draftWorkspace.current) === lastWorkspace.current && !pendingSave.current) return;
      preserveDraft(session.user.id);
      event.preventDefault();
      event.returnValue = "";
    };
    const externalStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || (event.key && !Object.values(STORAGE_KEYS).includes(event.key))) return;
      // Another tab uses the legacy localStorage bridge. Pause before it can
      // become this tab's next save, preserving this tab's in-memory draft.
      conflict.current = true;
      preserveDraft(session.user.id);
      setSyncStatus("conflict");
      setSyncError("다른 탭에서 자료를 변경했습니다. 이 탭의 변경사항을 보관한 후 최신 자료를 불러와 주세요.");
    };
    retry.current = () => void sync();
    const safetyTimer = window.setInterval(() => void sync(), 15000);
    window.addEventListener(WORKSPACE_CHANGE_EVENT, scheduleSync);
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("storage", externalStorage);
    window.addEventListener("online", retry.current);
    return () => {
      active = false;
      window.clearTimeout(debounceTimer);
      window.clearInterval(safetyTimer);
      window.removeEventListener(WORKSPACE_CHANGE_EVENT, scheduleSync);
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("storage", externalStorage);
      window.removeEventListener("online", retry.current);
    };
  }, [profile, session, workspaceReady, preserveDraft]);

  const downloadLocalChanges = () => {
    if (!draftWorkspace.current) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ savedLocallyAt: new Date().toISOString(), profileId: profile?.id, revisions: revisions.current, payload: draftWorkspace.current }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `SEMS_미저장변경_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const reloadWorkspace = async () => {
    if (!session || syncRunning.current || loadGuard.current.busy) return;
    if (JSON.stringify(draftWorkspace.current) !== lastWorkspace.current && !window.confirm("이 탭의 미저장 변경사항을 버리고 서버의 최신 자료를 불러오시겠습니까? 필요한 내용은 먼저 변경사항 내려받기로 보관해 주세요.")) return;
    const loadStamp = loadGuard.current.begin(session.user.id);
    setReloading(true);
    try {
      const result = await fetchWorkspace(session);
      if (!loadGuard.current.isCurrent(loadStamp) || activeUser.current !== session.user.id) return;
      const workspace = normalizeWorkspace(result.payload);
      revisions.current = result.revisions;
      lastWorkspace.current = JSON.stringify(workspace);
      draftWorkspace.current = workspace;
      pendingSave.current = null;
      conflict.current = false;
      window.sessionStorage.removeItem(draftKey(session.user.id));
      writeWorkspaceToBrowser(workspace);
      setProfile(result.profile);
      setSyncStatus("saved");
      setSyncError("");
      setWorkspaceVersion(version => version + 1);
    } catch (loadError) {
      if (loadGuard.current.isCurrent(loadStamp)) setSyncError(loadError instanceof Error ? loadError.message : "최신 자료를 불러오지 못했습니다.");
    } finally {
      if (loadGuard.current.finish(loadStamp)) setReloading(false);
    }
  };

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
    if ((JSON.stringify(draftWorkspace.current) !== lastWorkspace.current || pendingSave.current) && !window.confirm("서버 저장이 확인되지 않은 변경사항이 있습니다. 먼저 변경사항을 내려받아 보관하는 것이 좋습니다. 로그아웃하시겠습니까?")) return;
    if (session) preserveDraft(session.user.id);
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

  const isAdmin = isAdminRole(profile.role);
  const canManage = isAdmin;
  const canWrite = canWriteRequestedData(profile.role);
  const contextValue = {
    profile,
    syncStatus,
    syncError,
    retrySync: () => retry.current(),
    reloadWorkspace,
    downloadLocalChanges,
    canWrite,
    canReview: canManage,
    canManage,
    isAdmin,
    signOut,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      <div key={workspaceVersion} inert={syncStatus === "conflict" || reloading}>{children}</div>
      {reloading && <div className={styles.conflictOverlay}><section className={styles.syncCard} role="status" aria-live="polite"><strong>최신 자료를 불러오고 있습니다.</strong><p>서버 자료를 확인하는 동안 잠시 기다려 주세요.</p></section></div>}
      {!reloading && (syncStatus === "error" || syncStatus === "conflict") && <div className={syncStatus === "conflict" ? styles.conflictOverlay : styles.syncNotice}>
        <section className={styles.syncCard} role={syncStatus === "conflict" ? "alertdialog" : "alert"} aria-modal={syncStatus === "conflict" ? true : undefined} aria-labelledby="workspace-sync-title" aria-describedby="workspace-sync-description">
          <strong id="workspace-sync-title">{syncStatus === "conflict" ? "최신 변경사항을 확인해 주세요" : "서버에 저장하지 못했습니다"}</strong>
          <p id="workspace-sync-description">{syncError}</p>
          <p>이 탭의 변경사항은 보존되어 있습니다. 필요한 내용을 파일로 보관할 수 있습니다.</p>
          <div className={styles.syncActions}>
            <button type="button" onClick={downloadLocalChanges}>내 변경사항 내려받기</button>
            {syncStatus === "error" && <button type="button" onClick={() => retry.current()}>다시 저장</button>}
            <button type="button" onClick={() => void reloadWorkspace()}>최신 자료 불러오기</button>
          </div>
        </section>
      </div>}
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
