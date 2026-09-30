// Process liveness only; /api/health checks the external data service.
// Avoid restarting a healthy application during an external service outage.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
