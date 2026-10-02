import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortalProduct } from "../../../lib/api-server";
import { portalHref } from "../../../lib/tenant";
import { PortalFrame } from "../../../components/portal/portal-frame";
import { AppShell } from "../../../components/app-shell";
import { StatePage } from "../../../components/state-page";
import { Button } from "../../../components/ui/button";

interface PortalLayoutProps {
  children: React.ReactNode;
  params: Promise<{ ws: string; product: string }>;
}

export default async function PortalLayout({
  children,
  params,
}: PortalLayoutProps) {
  const { ws, product } = await params;
  const result = await getPortalProduct(ws, product);

  if (!result.ok) {
    if (result.status === 403 && result.code === "workspace_suspended") {
      return (
        <AppShell>
          <StatePage
            title="This page is unavailable"
            body="This portal isn't available right now. Check back later."
            actions={
              <Button variant="outline" asChild>
                <Link href="/">Go to UserHQ</Link>
              </Button>
            }
          />
        </AppShell>
      );
    }
    notFound();
  }

  const { data } = result;

  return (
    <PortalFrame
      homeHref={portalHref(ws, product)}
      name={data.product.name}
    >
      {children}
    </PortalFrame>
  );
}
