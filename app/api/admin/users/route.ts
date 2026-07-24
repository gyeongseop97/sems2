import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Role = "admin" | "manager" | "editor" | "viewer";

type CreateUserBody = {
  email?: string;
  password?: string;
  displayName?: string;
  department?: string;
  role?: Role;
  organizationId?: string | null;
  siteId?: string | null;
  active?: boolean;
};

type UpdateUserBody = {
  id?: string;
  displayName?: string;
  department?: string;
  role?: Role;
  organizationId?: string | null;
  siteId?: string | null;
  active?: boolean;
};

async function requireAdmin(request: NextRequest) {
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
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,role,active")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile?.active || profile.role !== "admin") {
    return { error: NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 }) };
  }

  return { admin, userId: authData.user.id };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ("error" in auth) return auth.error;

    const [{ data: profiles, error: profilesError }, { data: organizations, error: organizationsError }, { data: sites, error: sitesError }] = await Promise.all([
      auth.admin
        .from("profiles")
        .select("id,email,display_name,department,role,active,organization_id,site_id,created_at,organization:organizations(name),site:sites(name)")
        .order("created_at", { ascending: false }),
      auth.admin.from("organizations").select("id,name,active").order("name"),
      auth.admin.from("sites").select("id,name,organization_id,active").order("name"),
    ]);

    if (profilesError || organizationsError || sitesError) {
      return NextResponse.json({ error: profilesError?.message ?? organizationsError?.message ?? sitesError?.message }, { status: 500 });
    }

    return NextResponse.json({ profiles, organizations, sites });
  } catch (error) {
    const message = error instanceof Error ? error.message : "사용자 목록을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ("error" in auth) return auth.error;

    const body = await request.json() as CreateUserBody;
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const displayName = body.displayName?.trim() ?? "";
    const role = body.role ?? "viewer";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "올바른 이메일을 입력해 주세요." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "초기 비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
    }
    if (!displayName) {
      return NextResponse.json({ error: "사용자 이름을 입력해 주세요." }, { status: 400 });
    }
    if ((role === "editor" || role === "viewer") && !body.organizationId) {
      return NextResponse.json({ error: "자료 입력자와 조회자는 소속 법인을 지정해야 합니다." }, { status: 400 });
    }

    const { data: created, error: createError } = await auth.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

    if (createError || !created.user) {
      return NextResponse.json({ error: createError?.message ?? "계정을 생성하지 못했습니다." }, { status: 400 });
    }

    const { error: updateError } = await auth.admin
      .from("profiles")
      .update({
        email,
        display_name: displayName,
        department: body.department?.trim() ?? "",
        role,
        organization_id: body.organizationId ?? null,
        site_id: body.siteId ?? null,
        active: body.active ?? true,
      })
      .eq("id", created.user.id);

    if (updateError) {
      await auth.admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await auth.admin.from("audit_events").insert({
      actor_id: auth.userId,
      action: "사용자 생성",
      target: email,
      detail: `${displayName} 계정을 ${role} 권한으로 생성했습니다.`,
    });

    return NextResponse.json({ id: created.user.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "계정을 생성하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ("error" in auth) return auth.error;

    const body = await request.json() as UpdateUserBody;
    if (!body.id) {
      return NextResponse.json({ error: "사용자 ID가 없습니다." }, { status: 400 });
    }
    if ((body.role === "editor" || body.role === "viewer") && !body.organizationId) {
      return NextResponse.json({ error: "자료 입력자와 조회자는 소속 법인을 지정해야 합니다." }, { status: 400 });
    }

    const update = {
      ...(body.displayName !== undefined ? { display_name: body.displayName.trim() } : {}),
      ...(body.department !== undefined ? { department: body.department.trim() } : {}),
      ...(body.role !== undefined ? { role: body.role } : {}),
      ...(body.organizationId !== undefined ? { organization_id: body.organizationId } : {}),
      ...(body.siteId !== undefined ? { site_id: body.siteId } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    };

    const { data: updated, error: updateError } = await auth.admin
      .from("profiles")
      .update(update)
      .eq("id", body.id)
      .select("id,email,display_name,role,active")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await auth.admin.from("audit_events").insert({
      actor_id: auth.userId,
      action: "사용자 권한 변경",
      target: updated.email ?? updated.id,
      detail: `${updated.display_name} 계정의 권한 또는 사용 상태를 변경했습니다.`,
    });

    return NextResponse.json({ profile: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "사용자 정보를 변경하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
