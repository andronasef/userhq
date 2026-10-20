import { redirect } from "next/navigation";

interface CategoriesPageProps {
  params: Promise<{ ws: string; product: string }>;
}

export default async function CategoriesPage({
  params,
}: CategoriesPageProps): Promise<never> {
  const { ws, product } = await params;
  redirect(`/dashboard/${ws}/${product}/board?view=categories`);
}
