import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_EMISSION_FACTORS, withDefaultEmissionFactors } from "@/lib/emission-factor-library";

export const dynamic = "force-dynamic";

type Role = "admin" | "manager" | "editor" | "viewer";
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
  role: Role;
  active: boolean;
  organization_id: string | null;
  site_id: string | null;
  organization?: { name: string } | null;
  site?: { name: string } | null;
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
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return [
    collection,
    row.organization ?? row.company ?? "",
    row.id ?? "",
    row.code ?? "",
    row.at ?? "",
  ].join("|");
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

async function authenticate(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!url || !anonKey || !token) {
    return { error: NextResponse.json({ error: "인증 정보가 없습니다." }, { status: 401 }) };
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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

  return { admin, profile: data as unknown as Profile };
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
    const isManager = auth.profile.role === "admin" || auth.profile.role === "manager";
    const { data: rows, error } = await auth.admin
      .from("workspace_states")
      .select("scope_key,organization_id,payload");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const global = rows?.find((row) => row.scope_key === "global")?.payload;
    const organizationRows = isManager
      ? (rows ?? []).filter((row) => row.scope_key.startsWith("organization:")).map((row) => row.payload)
      : (rows ?? []).filter((row) => row.organization_id === auth.profile.organization_id).map((row) => row.payload);
    const payload = mergeWorkspace(global, organizationRows);
    payload.organizations = directory;

    return NextResponse.json({
      profile: auth.profile,
      payload,
      organizationCount: organizations.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "운영 데이터를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
    const isManager = auth.profile.role === "admin" || auth.profile.role === "manager";

    if (!isManager) {
      if (!auth.profile.organization_id || !auth.profile.organization?.name) {
        return NextResponse.json({ error: "소속 법인이 지정되지 않았습니다." }, { status: 400 });
      }

      const organizationName = auth.profile.organization.name;
      const organizationPayload = {
        ...EMPTY_WORKSPACE,
        records: payload.records.filter((value) => (value as { company?: string }).company === organizationName),
        metricSubmissions: payload.metricSubmissions.filter((value) => (value as { company?: string }).company === organizationName),
        evidence: payload.evidence.filter((value) => {
          const organization = (value as { organization?: string; company?: string }).organization
            ?? (value as { company?: string }).company;
          return !organization || organization === organizationName;
        }),
        targets: payload.targets.filter((value) => (value as { company?: string }).company === organizationName),
        plans: payload.plans.filter((value) => (value as { company?: string }).company === organizationName),
        audit: payload.audit,
        organizations: {},
      };

      const { error } = await auth.admin.from("workspace_states").upsert({
        scope_key: `organization:${auth.profile.organization_id}`,
        organization_id: auth.profile.organization_id,
        payload: organizationPayload,
        updated_by: auth.profile.id,
        updated_at: now,
      }, { onConflict: "scope_key" });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ savedAt: now });
    }

    const { organizations } = await getOrganizationDirectory();
    const organizationByName = new Map(organizations.map((organization) => [organization.name, organization.id]));
    const globalPayload: WorkspacePayload = {
      ...payload,
      records: [],
      metricSubmissions: [],
      evidence: [],
      targets: payload.targets.filter((value) => (value as { company?: string }).company === "그룹 전체"),
      plans: [],
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
        records: payload.records.filter((value) => (value as { company?: string }).company === name),
        metricSubmissions: payload.metricSubmissions.filter((value) => (value as { company?: string }).company === name),
        evidence: payload.evidence.filter((value) => {
          const assigned = (value as { organization?: string; company?: string }).organization
            ?? (value as { company?: string }).company;
          return assigned === name;
        }),
        targets: payload.targets.filter((value) => (value as { company?: string }).company === name),
        plans: payload.plans.filter((value) => (value as { company?: string }).company === name),
        audit: [],
        organizations: {},
      };
      upserts.push({
        scope_key: `organization:${organizationByName.get(name)}`,
        organization_id: organization.id,
        payload: organizationPayload,
        updated_by: auth.profile.id,
        updated_at: now,
      });
    }

    const { error } = await auth.admin
      .from("workspace_states")
      .upsert(upserts, { onConflict: "scope_key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ savedAt: now });
  } catch (error) {
    const message = error instanceof Error ? error.message : "운영 데이터를 저장하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
