import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getServerI18n } from "@/lib/i18n/server";
import { getMe, getPlatformWorkspace } from "@/lib/api-server";
import { PlatformHeader } from "@/components/platform/platform-header";
import { WorkspaceDetailHeader } from "@/components/platform/workspace-detail-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { portalHref } from "@/lib/tenant";
import { formatDate } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
  return {
    title: t("platform.metaTitle"),
  };
}

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

  const { t } = await getServerI18n();
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
        deleted={ws.deleted}
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">{t("platform.productsTitle")}</h2>
        {ws.products.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("platform.noProducts")}</p>
        ) : (
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>{t("platform.colProduct")}</TH>
                  <TH>{t("platform.colUrl")}</TH>
                  <TH className="text-right">{t("platform.colPosts")}</TH>
                  <TH className="text-right">{t("platform.colVotes")}</TH>
                  <TH>{t("platform.colState")}</TH>
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
                        <Badge variant="outline">{t("platform.stateLive")}</Badge>
                      ) : (
                        <Badge variant="neutral">{t("platform.stateDeleted")}</Badge>
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
        <h2 className="text-lg font-semibold text-foreground">{t("platform.membersTitle")}</h2>
        {ws.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("platform.noMembers")}</p>
        ) : (
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>{t("platform.colMember")}</TH>
                  <TH>{t("platform.colRole")}</TH>
                  <TH>{t("platform.colJoined")}</TH>
                </TR>
              </THead>
              <TBody>
                {ws.members.map((m) => (
                  <TR key={m.email}>
                    <TD>
                      <div className="font-medium text-foreground">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                    </TD>
                    <TD>
                      <Badge variant="outline" className="capitalize">
                        {m.role}
                      </Badge>
                    </TD>
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
