/**
 * Unauthenticated liveness probe for platform health checks — exempt from
 * the staging password in middleware. Exposes nothing but a heartbeat.
 */
export async function GET() {
  return Response.json({ ok: true });
}
