import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GET as readAuthorizedWorkspace } from "@/app/api/workspace/route";
import { createAiHandlers, type AiAccess } from "@/lib/server/ai-handler";
import { readAiConfiguration, generateAiDraft, extractAiDocument } from "@/lib/server/ai-provider";
import { AI_MAX_FILE_BYTES, inspectAiFile } from "@/lib/ai/extraction";

import { saveAiAnswerHistory } from "@/lib/server/ai-history";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const usageWindows = new Map<string, { count: number; until: number }>();
const handlers = createAiHandlers({
  config: readAiConfiguration,
  async loadWorkspace(request) {
    // Reuse the authoritative GET authentication and company/site projection. Strip query parameters so audit mode cannot be selected.
    const scopedRequest = new NextRequest(new URL("/api/workspace", request.url), {
      headers: { authorization: request.headers.get("authorization") ?? "" },
    });
    const result = await readAuthorizedWorkspace(scopedRequest);
    if (!result) return Response.json({ error: "등록 자료를 확인하지 못했습니다." }, { status: 500 });
    if (!result.ok) return result;
    return await result.json() as AiAccess;
  },
  draft: generateAiDraft,
  saveAnswer: saveAiAnswerHistory,
  extract: extractAiDocument,
  async download(candidate, request) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const authorization = request.headers.get("authorization");
    if (!url || !anonKey || !authorization) return null;
    // User-token client preserves Storage RLS; never retry with the service-role key.
    const client = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.storage.from("sems2-evidence").download(candidate.storagePath);
    if (error || !data || data.size > AI_MAX_FILE_BYTES) return null;
    const bytes = new Uint8Array(await data.arrayBuffer());
    const mediaType = inspectAiFile(bytes, data.type);
    return mediaType ? { bytes, mediaType, filename: candidate.fileName } : null;
  },
  allowRequest(userId) {
    const now = Date.now();
    for (const [id, window] of usageWindows) if (window.until < now) usageWindows.delete(id);
    const current = usageWindows.get(userId);
    if (current && current.count >= 8) return false;
    if (current) current.count += 1;
    else if (usageWindows.size < 5000) usageWindows.set(userId, { count: 1, until: now + 60_000 });
    else return false;
    return true;
  },
});

export const GET = handlers.GET;
export const POST = handlers.POST;
