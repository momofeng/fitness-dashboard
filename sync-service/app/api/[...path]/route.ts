import { env } from "cloudflare:workers";
import { handleVaultRequest, type VaultEnv } from "../../../server/vault";
export const dynamic = "force-dynamic";
async function handler(request: Request) {
  if (!env.DB || !env.BUCKET) return new Response(JSON.stringify({ error: "storage_not_configured" }), { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  return handleVaultRequest(request, { DB: env.DB, BUCKET: env.BUCKET } as unknown as VaultEnv);
}
export { handler as GET, handler as POST, handler as PUT, handler as OPTIONS };
