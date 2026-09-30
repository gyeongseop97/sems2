import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceRevisions } from "../workspace-integrity";

// Infrastructure boundary only. Authorization and business validation stay in
// the request handler/domain modules and must run before these operations.
export function createWorkspaceStore(client: SupabaseClient) {
  return {
    readStates(scopes?: string[]) {
      const query = client.from("workspace_states").select("scope_key,organization_id,payload,revision");
      return scopes ? query.in("scope_key", scopes) : query;
    },
    readReceipt(actorId: string, mutationId: string) {
      return client.from("workspace_save_receipts").select("result")
        .eq("actor_id", actorId).eq("mutation_id", mutationId).maybeSingle();
    },
    readHistory(before: string | null) {
      const query = client.from("workspace_change_log").select("*")
        .order("id", { ascending: false }).limit(101);
      return before ? query.lt("id", before) : query;
    },
    saveChecked(states: Record<string, unknown>[], expected: WorkspaceRevisions, actorId: string, mutationId: string) {
      // Keep the atomic RPC: separate upserts would lose concurrency,
      // idempotency and audit guarantees when changing database providers.
      return client.rpc("save_workspace_checked", {
        p_expected: expected, p_states: states,
        p_actor_id: actorId, p_mutation_id: mutationId,
      });
    },
    async readOrganizationDirectory() {
      const [organizationsResult, sitesResult] = await Promise.all([
        client.from("organizations").select("id,name,active").eq("active", true).order("name"),
        client.from("sites").select("id,name,organization_id,active").eq("active", true).order("name"),
      ]);
      if (organizationsResult.error || sitesResult.error) {
        throw new Error(organizationsResult.error?.message ?? sitesResult.error?.message ?? "조직 정보를 불러오지 못했습니다.");
      }
      const organizations = organizationsResult.data ?? [];
      const sites = sitesResult.data ?? [];
      const directory: Record<string, string[]> = {};
      for (const organization of organizations) {
        directory[organization.name] = sites.filter(site => site.organization_id === organization.id).map(site => site.name);
      }
      return { organizations, directory };
    },
  };
}
