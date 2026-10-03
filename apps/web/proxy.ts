import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { parsePostRef, postHref } from "./lib/tenant";

export async function proxy(request: NextRequest): Promise<Response> {
  const { pathname, search } = request.nextUrl;

  const postMatch = pathname.match(/^\/([^/]+)\/([^/]+)\/p\/([^/]+)$/);
  if (postMatch) {
    const [, ws, product, ref] = postMatch;
    const postNumber = parsePostRef(ref);
    if (postNumber) {
      const apiInternalUrl = process.env.API_INTERNAL_URL || "http://localhost:4000";
      try {
        const cookie = request.headers.get("cookie");
        const headers: Record<string, string> = {};
        if (cookie) headers["cookie"] = cookie;

        const res = await fetch(
          `${apiInternalUrl}/api/v1/portal/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/posts/${postNumber}`,
          {
            headers,
            cache: "no-store",
          }
        );
        if (res.ok) {
          const data = await res.json();
          let canonicalPath: string | null = null;
          if (data.kind === "redirect") {
            canonicalPath = postHref(ws, product, data.number, data.slug);
          } else if (data.kind === "post") {
            canonicalPath = postHref(ws, product, data.post.number, data.post.slug);
          }
          if (canonicalPath && pathname !== canonicalPath) {
            const location = search ? `${canonicalPath}${search}` : canonicalPath;
            return new Response(null, {
              status: 301,
              headers: {
                Location: location,
              },
            });
          }
        }
      } catch {
        // Fall through on fetch error
      }
    }
    return NextResponse.next();
  }

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
  matcher: [
    "/dev/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/invite/:path*",
    "/:ws/:product/p/:ref*",
  ],
};
