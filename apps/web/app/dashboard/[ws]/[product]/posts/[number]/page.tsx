import { notFound, redirect } from "next/navigation";
import { dashboardPostHref, parsePostRef } from "@/lib/tenant";

interface RedirectPostPageProps {
  params: Promise<{ ws: string; product: string; number: string }>;
}

export default async function RedirectPostPage({
  params,
}: RedirectPostPageProps): Promise<never> {
  const { ws, product, number } = await params;
  const num = parsePostRef(number);
  if (num === null) notFound();
  redirect(dashboardPostHref(ws, product, num));
}
