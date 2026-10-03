import { redirect } from "next/navigation";

interface ProductIndexPageProps {
  params: Promise<{ ws: string; product: string }>;
}

export default async function ProductIndexPage({
  params,
}: ProductIndexPageProps): Promise<never> {
  const { ws, product } = await params;
  redirect(`/dashboard/${ws}/${product}/settings`);
}
