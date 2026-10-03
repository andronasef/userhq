import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest): Response {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/dev") && process.env.DEV_UPLOAD_PAGE !== "true") {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const next = encodeURIComponent(pathname + search);
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
  matcher: ["/dev/:path*", "/dashboard", "/dashboard/:path*", "/invite/:path*"],
};
