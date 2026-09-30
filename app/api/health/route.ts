import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        status: "degraded",
        app: "ok",
        supabase: "not_configured",
        missing: [
          !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
          !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
        ].filter(Boolean),
      },
      { status: 503 },
    );
  }

  try {
    // The REST root/OpenAPI endpoint may reject anonymous requests even when
    // the database is healthy. Verify the application's server read permission
    // without returning any business records or changing data.
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/workspace_states?select=scope_key&limit=0`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    return NextResponse.json(
      {
        status: response.ok ? "ok" : "degraded",
        app: "ok",
        supabase: response.ok ? "connected" : "unreachable",
        supabaseStatus: response.status,
      },
      { status: response.ok ? 200 : 503 },
    );
  } catch {
    return NextResponse.json(
      { status: "degraded", app: "ok", supabase: "connection_failed" },
      { status: 503 },
    );
  }
}
