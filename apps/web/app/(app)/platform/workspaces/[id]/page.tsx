import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getMe, getPlatformWorkspace } from "@/lib/api-server";
import { PlatformHeader } from "@/components/platform/platform-header";
import { WorkspaceDetailHeader } from "@/components/platform/workspace-detail-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { portalHref } from "@/lib/tenant";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Platform · UserHQ",
};

export default async function PlatformWorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await getMe();
  if (!me.isPlatformOwner) {
    notFound();
  }

  const { id } = await params;
  const result = await getPlatformWorkspace(id);
  if (!result.ok) {
    notFound();
  }

  const ws = result.data;

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4 sm:px-6 flex flex-col gap-8">
      <PlatformHeader activeTab="/platform/workspaces" />

      <WorkspaceDetailHeader
        id={ws.id}
        name={ws.name}
        slug={ws.slug}
        logoUrl={ws.logoUrl}
        suspended={ws.suspended}
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">Products</h2>
        {ws.products.length === 0 ? (
          <p className="text-sm text-muted-foreground">No products in this workspace.</p>
        ) : (
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH>URL</TH>
                  <TH className="text-right">Posts</TH>
                  <TH className="text-right">Votes</TH>
                  <TH>State</TH>
                </TR>
              </THead>
              <TBody>
                {ws.products.map((p) => (
                  <TR key={p.slug}>
                    <TD className="font-medium text-foreground">{p.name}</TD>
                    <TD>
                      <Link
                        href={portalHref(ws.slug, p.slug)}
                        className="font-mono text-sm text-muted-foreground hover:underline"
                      >
                        /{ws.slug}/{p.slug}
                      </Link>
                    </TD>
                    <TD className="text-right tabular-nums text-muted-foreground">
                      {p.postCount}
                    </TD>
                    <TD className="text-right tabular-nums text-muted-foreground">
                      {p.voteCount}
                    </TD>
                    <TD>
                      {p.live ? (
                        <Badge variant="outline">Live</Badge>
                      ) : (
                        <Badge variant="neutral">Deleted</Badge>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">Members</h2>
        {ws.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members in this workspace.</p>
        ) : (
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Member</TH>
                  <TH>Role</TH>
                  <TH>Joined</TH>
                </TR>
              </THead>
              <TBody>
                {ws.members.map((m) => (
                  <TR key={m.email}>
                    <TD>
                      <div className="font-medium text-foreground">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                    </TD>
                    <TD className="capitalize text-muted-foreground">{m.role}</TD>
                    <TD className="text-muted-foreground">{formatDate(m.joinedAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
