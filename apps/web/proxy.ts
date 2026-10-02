import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest): Response {
  if (process.env.DEV_UPLOAD_PAGE !== "true") {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const next = encodeURIComponent(
      request.nextUrl.pathname + request.nextUrl.search
    );
    return new Response(null, {
      status: 307,
      headers: {
        Location: `/login?next=${next}`,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dev/:path*"],
};
