import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      {
        status: "degraded",
        app: "ok",
        supabase: "not_configured",
        missing: [
          !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
          !supabaseAnonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null,
        ].filter(Boolean),
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      cache: "no-store",
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
      {
        status: "degraded",
        app: "ok",
        supabase: "connection_failed",
      },
      { status: 503 },
    );
  }
}
