import { NextRequest } from "next/server";
import { GET as readAuthorizedWorkspace } from "@/app/api/workspace/route";
import type { AiAccess } from "@/lib/server/ai-handler";
import { aiHistoryAccessKey, aiHistoryClient } from "@/lib/server/ai-history";

export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
async function authenticate(request: Request): Promise<AiAccess | Response> {
  const response = await readAuthorizedWorkspace(new NextRequest(new URL("/api/workspace", request.url), { headers: { authorization: request.headers.get("authorization") ?? "" } }));
  if (!response) return json({ error: "로그인을 확인하지 못했습니다." }, 500);
  if (!response.ok) return response;
  const access = await response.json() as AiAccess;
  if (!access.profile.active || !["admin", "manager", "editor", "viewer"].includes(access.profile.role)) return json({ error: "사용 가능한 계정이 필요합니다." }, 403);
  return access;
}
export async function GET(request: Request) {
  try {
    const access = await authenticate(request);
    if (access instanceof Response) return access;
    const { data, error } = await aiHistoryClient(request).from("ai_answer_history")
      .select("id,created_at,question,result").eq("user_id", access.profile.id).eq("access_key", aiHistoryAccessKey(access))
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100);
    if (error) throw error;
    return json({ entries: (data ?? []).map(row => ({ id: row.id, createdAt: row.created_at, question: row.question, result: row.result })) });
  } catch { return json({ error: "답변 기록을 불러오지 못했습니다. 서버 DB에 AI 기록 SQL이 적용되었는지 확인해 주세요." }, 503); }
}
export async function DELETE(request: Request) {
  try {
    const access = await authenticate(request);
    if (access instanceof Response) return access;
    const { error } = await aiHistoryClient(request).from("ai_answer_history").delete().eq("user_id", access.profile.id);
    if (error) throw error;
    return json({ deleted: true });
  } catch { return json({ error: "답변 기록을 삭제하지 못했습니다." }, 503); }
}
