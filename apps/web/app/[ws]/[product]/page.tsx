import * as React from "react";
import { Hammer } from "lucide-react";
import { getPortalProduct } from "../../../lib/api-server";
import { EmptyState } from "../../../components/empty-state";

interface PortalPageProps {
  params: Promise<{ ws: string; product: string }>;
}

export default async function PortalPage({ params }: PortalPageProps) {
  const { ws, product } = await params;
  const result = await getPortalProduct(ws, product);

  if (!result.ok) {
    return null;
  }

  const { data } = result;

  return (
    <div className="max-w-xl mx-auto">
      <EmptyState
        as="h1"
        icon={<Hammer className="size-6 text-muted-foreground" />}
        title={`${data.product.name} is getting set up`}
        body={`Feedback, roadmap, and updates for ${data.product.name} will appear here soon.`}
      />
    </div>
  );
}
