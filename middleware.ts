import { NextResponse, type NextRequest } from "next/server";

/**
 * Staging gate: when STAGING_PASSWORD is set, everything (pages and API)
 * requires HTTP basic auth — any username, that password. Unset locally,
 * so development is unaffected.
 */
export function middleware(request: NextRequest) {
  const password = process.env.STAGING_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    try {
      const supplied = atob(encoded).split(":").slice(1).join(":");
      if (supplied === password) return NextResponse.next();
    } catch {
      // Malformed header — fall through to the challenge.
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "www-authenticate": 'Basic realm="Ad Studio staging"' },
  });
}

export const config = {
  // api/health stays open — platform health checks can't send credentials.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
