import { redirect } from "next/navigation";

interface RedirectPostsProps {
  params: Promise<{ ws: string; product: string }>;
}

export default async function RedirectPostsPage({
  params,
}: RedirectPostsProps): Promise<never> {
  const { ws, product } = await params;
  redirect(
    `/dashboard/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/board`
  );
}
