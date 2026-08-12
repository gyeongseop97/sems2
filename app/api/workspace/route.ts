import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { isAdminRole, normalizeSemsRole, type SemsRole, type StoredSemsRole } from "@/lib/access-control";
import { DEFAULT_EMISSION_FACTORS, withDefaultEmissionFactors } from "@/lib/emission-factor-library";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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

type Profile = {
  id: string;
  email: string | null;
  display_name: string;
  department: string;
  role: SemsRole;
  active: boolean;
  organization_id: string | null;
  site_id: string | null;
  organization?: { name: string } | null;
  site?: { name: string } | null;
};

type StoredProfile = Omit<Profile, "role"> & { role: StoredSemsRole };
type WorkspaceRow = { scope_key: string; organization_id: string | null; payload: unknown };
type DataRow = Record<string, unknown>;

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

function asRow(value: unknown): DataRow {
  return value && typeof value === "object" ? value as DataRow : {};
}

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

function rowKey(value: unknown, collection: keyof WorkspacePayload) {
  const row = asRow(value);
  return [collection, row.organization ?? row.company ?? "", row.id ?? "", row.code ?? "", row.at ?? ""].join("|");
}

function mergeRows(collection: keyof WorkspacePayload, groups: unknown[][]) {
  const result: unknown[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const value of group) {
      const key = rowKey(value, collection);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(value);
    }
  }
  return result;
}

function mergeWorkspace(globalValue: unknown, organizationValues: unknown[]) {
  const global = normalizeWorkspace(globalValue);
  const organizations = organizationValues.map(normalizeWorkspace);
  return {
    ...global,
    records: mergeRows("records", [global.records, ...organizations.map((item) => item.records)]),
    metricSubmissions: mergeRows("metricSubmissions", [global.metricSubmissions, ...organizations.map((item) => item.metricSubmissions)]),
    evidence: mergeRows("evidence", [global.evidence, ...organizations.map((item) => item.evidence)]),
    targets: mergeRows("targets", [global.targets, ...organizations.map((item) => item.targets)]),
    plans: mergeRows("plans", [global.plans, ...organizations.map((item) => item.plans)]),
    audit: mergeRows("audit", [global.audit, ...organizations.map((item) => item.audit)]),
  } satisfies WorkspacePayload;
}

function assignedToOrganization(value: unknown, organizationName: string, key: "companies" | "organizationScope") {
  const assigned = asRow(value)[key];
  return Array.isArray(assigned) && assigned.includes(organizationName);
}

function filterAssignedRows(rows: unknown[], organizationName: string, key: "companies" | "organizationScope") {
  return rows
    .filter((value) => assignedToOrganization(value, organizationName, key))
    .map((value) => ({ ...asRow(value), [key]: [organizationName] }));
}

function filterCompanyRows(rows: unknown[], organizationName: string, key: "company" | "organization") {
  return rows.filter((value) => asRow(value)[key] === organizationName);
}

function scopeWorkspaceForOrganization(globalValue: unknown, organizationValue: unknown, organizationName: string, sites: string[]) {
  const global = normalizeWorkspace(globalValue);
  const organization = normalizeWorkspace(organizationValue);
  return {
    ...global,
    periods: filterAssignedRows(global.periods, organizationName, "companies"),
    records: filterCompanyRows(organization.records, organizationName, "company"),
    assetUnits: filterCompanyRows(global.assetUnits, organizationName, "company"),
    scope3Requests: filterAssignedRows(global.scope3Requests, organizationName, "organizationScope"),
    supplyChainAssessments: [],
    evidence: organization.evidence
      .filter((value) => !asRow(value).organization || asRow(value).organization === organizationName)
      .map((value) => ({ ...asRow(value), organization: organizationName })),
    metricRequests: filterAssignedRows(global.metricRequests, organizationName, "companies"),
    metricSubmissions: filterCompanyRows(organization.metricSubmissions, organizationName, "company"),
    reports: filterCompanyRows(global.reports, organizationName, "organization"),
    targets: filterCompanyRows(organization.targets, organizationName, "company"),
    plans: filterCompanyRows(organization.plans, organizationName, "company"),
    audit: organization.audit,
    organizations: { [organizationName]: sites },
  } satisfies WorkspacePayload;
}

async function authenticate(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!url || !anonKey || !token) {
    return { error: NextResponse.json({ error: "인증 정보가 없습니다." }, { status: 401 }) };
  }

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return { error: NextResponse.json({ error: "로그인 세션이 유효하지 않습니다." }, { status: 401 }) };
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id,email,display_name,department,role,active,organization_id,site_id,organization:organizations(name),site:sites(name)")
    .eq("id", authData.user.id)
    .single();

  if (error || !data || !data.active) {
    return { error: NextResponse.json({ error: "활성화된 SEMS 사용 권한이 없습니다." }, { status: 403 }) };
  }

  const stored = data as unknown as StoredProfile;
  const profile: Profile = { ...stored, role: normalizeSemsRole(stored.role) };
  return { admin, profile };
}

async function getOrganizationDirectory() {
  const admin = getSupabaseAdminClient();
  const [{ data: organizations, error: organizationError }, { data: sites, error: siteError }] = await Promise.all([
    admin.from("organizations").select("id,name,active").eq("active", true).order("name"),
    admin.from("sites").select("id,name,organization_id,active").eq("active", true).order("name"),
  ]);

  if (organizationError || siteError) {
    throw new Error(organizationError?.message ?? siteError?.message ?? "조직 정보를 불러오지 못했습니다.");
  }

  const directory: Record<string, string[]> = {};
  for (const organization of organizations ?? []) {
    directory[organization.name] = (sites ?? [])
      .filter((site) => site.organization_id === organization.id)
      .map((site) => site.name);
  }
  return { organizations: organizations ?? [], directory };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { organizations, directory } = await getOrganizationDirectory();
    const isAdmin = isAdminRole(auth.profile.role);
    if (!isAdmin && (!auth.profile.organization_id || !auth.profile.organization?.name)) {
      return NextResponse.json({ error: "자료 입력자와 조회자는 소속 법인이 지정되어야 합니다." }, { status: 403 });
    }

    let query = auth.admin.from("workspace_states").select("scope_key,organization_id,payload");
    if (!isAdmin) {
      query = query.in("scope_key", ["global", `organization:${auth.profile.organization_id}`]);
    }
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []) as WorkspaceRow[];
    const global = rows.find((row) => row.scope_key === "global")?.payload;
    const payload = isAdmin
      ? mergeWorkspace(global, rows.filter((row) => row.scope_key.startsWith("organization:")).map((row) => row.payload))
      : scopeWorkspaceForOrganization(
          global,
          rows.find((row) => row.organization_id === auth.profile.organization_id)?.payload,
          auth.profile.organization!.name,
          directory[auth.profile.organization!.name] ?? [],
        );
    if (isAdmin) payload.organizations = directory;

    return NextResponse.json({ profile: auth.profile, payload, organizationCount: isAdmin ? organizations.length : 1 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "운영 데이터를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function mergeEditorRows(
  existingRows: unknown[],
  incomingRows: unknown[],
  canEdit: (row: DataRow) => boolean,
  isProtected: (row: DataRow) => boolean,
  sanitize: (row: DataRow, existing?: DataRow) => DataRow,
) {
  const incoming = new Map(incomingRows.map((value) => [String(asRow(value).id ?? rowKey(value, "records")), asRow(value)]));
  const result: DataRow[] = [];
  for (const value of existingRows) {
    const current = asRow(value);
    const key = String(current.id ?? rowKey(value, "records"));
    const next = incoming.get(key);
    incoming.delete(key);
    if (isProtected(current) || !canEdit(current)) {
      result.push(current);
    } else if (next) {
      result.push(sanitize(next, current));
    }
  }
  for (const next of incoming.values()) {
    if (canEdit(next)) result.push(sanitize(next));
  }
  return result;
}

function sanitizeAudit(existing: unknown[], incoming: unknown[], profile: Profile, organizationName: string) {
  const known = new Set(existing.map((value) => rowKey(value, "audit")));
  const additions = incoming
    .filter((value) => !known.has(rowKey(value, "audit")))
    .slice(0, 100)
    .map((value) => {
      const row = asRow(value);
      return {
        id: row.id ?? Date.now(),
        at: String(row.at ?? new Date().toISOString()),
        actor: profile.display_name || profile.email || "자료 입력자",
        action: String(row.action ?? "자료 변경").slice(0, 100),
        target: String(row.target ?? organizationName).slice(0, 200),
        detail: String(row.detail ?? "").slice(0, 1000),
        organization: organizationName,
      };
    });
  return [...additions, ...existing].slice(0, 500);
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;
    if (auth.profile.role === "viewer") {
      return NextResponse.json({ error: "조회자는 운영 데이터를 변경할 수 없습니다." }, { status: 403 });
    }

    const body = await request.json() as { payload?: unknown };
    const payload = normalizeWorkspace(body.payload);
    const now = new Date().toISOString();
    const isAdmin = isAdminRole(auth.profile.role);

    if (!isAdmin) {
      if (!auth.profile.organization_id || !auth.profile.organization?.name) {
        return NextResponse.json({ error: "소속 법인이 지정되지 않았습니다." }, { status: 400 });
      }

      const organizationId = auth.profile.organization_id;
      const organizationName = auth.profile.organization.name;
      const scopeKey = `organization:${organizationId}`;
      const { data: stateRows, error: stateError } = await auth.admin
        .from("workspace_states")
        .select("scope_key,payload")
        .in("scope_key", ["global", scopeKey]);
      if (stateError) return NextResponse.json({ error: stateError.message }, { status: 500 });

      const global = normalizeWorkspace(stateRows?.find((row) => row.scope_key === "global")?.payload);
      const existing = normalizeWorkspace(stateRows?.find((row) => row.scope_key === scopeKey)?.payload);
      const periods = new Map(global.periods.map((value) => [String(asRow(value).id ?? ""), asRow(value)]));
      const requests = new Map(global.metricRequests.map((value) => [String(asRow(value).id ?? ""), asRow(value)]));
      const canEditRecord = (row: DataRow) => {
        const period = periods.get(String(row.collectionId ?? ""));
        return row.company === organizationName
          && period?.status === "수집중"
          && Array.isArray(period.companies)
          && period.companies.includes(organizationName);
      };
      const canEditSubmission = (row: DataRow) => {
        const requestRow = requests.get(String(row.requestId ?? ""));
        return row.company === organizationName
          && requestRow?.status === "수집중"
          && Array.isArray(requestRow.companies)
          && requestRow.companies.includes(organizationName)
          && Array.isArray(requestRow.indicatorIds)
          && requestRow.indicatorIds.map(String).includes(String(row.indicatorId ?? ""));
      };

      const records = mergeEditorRows(
        existing.records,
        payload.records.filter((value) => asRow(value).company === organizationName),
        canEditRecord,
        (row) => row.status === "검토대기" || row.status === "확정" || row.locked === true,
        (row, current) => ({
          ...row,
          company: organizationName,
          status: row.status === "검토대기" ? "검토대기" : current?.status === "반려" ? "반려" : "작성중",
          locked: false,
        }),
      );
      const metricSubmissions = mergeEditorRows(
        existing.metricSubmissions,
        payload.metricSubmissions.filter((value) => asRow(value).company === organizationName),
        canEditSubmission,
        (row) => row.status === "검토대기" || row.status === "확정",
        (row, current) => ({
          ...row,
          company: organizationName,
          status: row.status === "검토대기" ? "검토대기" : current?.status === "반려" ? "반려" : "작성중",
        }),
      );
      const evidence = mergeEditorRows(
        existing.evidence,
        payload.evidence.filter((value) => asRow(value).organization === organizationName),
        (row) => row.organization === organizationName,
        (row) => row.status === "승인" || row.status === "만료",
        (row, current) => {
          const incomingPath = String(row.storagePath ?? "");
          const allowedPrefix = `${organizationId}/${auth.profile.id}/`;
          const storagePath = incomingPath === String(current?.storagePath ?? "") || incomingPath.startsWith(allowedPrefix)
            ? incomingPath
            : String(current?.storagePath ?? "");
          return { ...row, organization: organizationName, storagePath, status: "검토중" };
        },
      );
      const organizationPayload: WorkspacePayload = {
        ...EMPTY_WORKSPACE,
        records,
        metricSubmissions,
        evidence,
        targets: existing.targets,
        plans: existing.plans,
        audit: sanitizeAudit(existing.audit, payload.audit, auth.profile, organizationName),
        organizations: {},
      };

      const { error } = await auth.admin.from("workspace_states").upsert({
        scope_key: scopeKey,
        organization_id: organizationId,
        payload: organizationPayload,
        updated_by: auth.profile.id,
        updated_at: now,
      }, { onConflict: "scope_key" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ savedAt: now });
    }

    const { organizations } = await getOrganizationDirectory();
    const globalPayload: WorkspacePayload = {
      ...payload,
      records: [],
      metricSubmissions: [],
      evidence: payload.evidence.filter((value) => !asRow(value).organization),
      targets: payload.targets.filter((value) => asRow(value).company === "그룹 전체"),
      plans: [],
      audit: payload.audit.filter((value) => !asRow(value).organization),
      organizations: {},
    };
    const upserts: Record<string, unknown>[] = [{
      scope_key: "global",
      organization_id: null,
      payload: globalPayload,
      updated_by: auth.profile.id,
      updated_at: now,
    }];

    for (const organization of organizations) {
      const name = organization.name;
      const organizationPayload: WorkspacePayload = {
        ...EMPTY_WORKSPACE,
        records: filterCompanyRows(payload.records, name, "company"),
        metricSubmissions: filterCompanyRows(payload.metricSubmissions, name, "company"),
        evidence: filterCompanyRows(payload.evidence, name, "organization"),
        targets: filterCompanyRows(payload.targets, name, "company"),
        plans: filterCompanyRows(payload.plans, name, "company"),
        audit: payload.audit.filter((value) => asRow(value).organization === name),
        organizations: {},
      };
      upserts.push({
        scope_key: `organization:${organization.id}`,
        organization_id: organization.id,
        payload: organizationPayload,
        updated_by: auth.profile.id,
        updated_at: now,
      });
    }

    const { error } = await auth.admin.from("workspace_states").upsert(upserts, { onConflict: "scope_key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ savedAt: now });
  } catch (error) {
    const message = error instanceof Error ? error.message : "운영 데이터를 저장하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
