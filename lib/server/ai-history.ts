import { createClient } from "@supabase/supabase-js";
import type { AiAccess } from "./ai-handler";
import type { AiResult } from "../ai/types";

export function aiHistoryAccessKey(access: AiAccess) {
  return JSON.stringify([access.profile.role, access.profile.organization?.name ?? "", access.profile.site?.name ?? "", Object.entries(access.payload.organizations).sort(([a], [b]) => a.localeCompare(b)).map(([name, sites]) => [name, [...sites].sort()])]);
}

export function aiHistoryClient(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !key || !authorization) throw new Error("History authentication unavailable");
  return createClient(url, key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
}

export async function saveAiAnswerHistory(request: Request, access: AiAccess, question: string, result: AiResult) {
  const { error } = await aiHistoryClient(request).rpc("save_ai_answer_history", {
    p_question: question, p_result: result, p_access_key: aiHistoryAccessKey(access),
  });
  if (error) throw new Error("AI history save failed");
}
