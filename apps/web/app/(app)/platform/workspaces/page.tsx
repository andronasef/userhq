import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getServerI18n } from "@/lib/i18n/server";
import { getMe, getPlatformWorkspaces } from "@/lib/api-server";
import { PlatformHeader } from "@/components/platform/platform-header";
import { WorkspacesTable } from "@/components/platform/workspaces-table";
import { Pager } from "@/components/platform/pager";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
  return {
    title: t("platform.metaTitle"),
  };
}

export default async function PlatformWorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const me = await getMe();
  if (!me.isPlatformOwner) {
    notFound();
  }

  const { t } = await getServerI18n();
  const { q, page: pageStr } = await searchParams;
  const page = pageStr ? Math.max(1, parseInt(pageStr, 10) || 1) : 1;
  const trimmedQ = q?.trim() || "";

  const result = await getPlatformWorkspaces(trimmedQ || undefined, page);
  const data = result.ok ? result.data : { rows: [], page: 1, hasNext: false };

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4 sm:px-6 flex flex-col gap-8">
      <PlatformHeader activeTab="/platform/workspaces" />

      <section className="flex flex-col gap-4">
        <form method="get" className="flex items-center gap-2">
          <Input
            type="search"
            name="q"
            defaultValue={trimmedQ}
            placeholder={t("platform.searchWorkspacesPlaceholder")}
            className="w-full sm:w-72"
          />
        </form>

        {data.rows.length === 0 ? (
          trimmedQ ? (
            <EmptyState
              title={t("platform.noWorkspacesMatchTitle")}
              body={t("platform.noWorkspacesMatchBody", { query: trimmedQ })}
              action={
                <Button variant="outline" asChild>
                  <Link href="/platform/workspaces">{t("platform.clearSearch")}</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              title={t("platform.noWorkspacesYetTitle")}
              body={t("platform.noWorkspacesYetBody")}
            />
          )
        ) : (
          <>
            <WorkspacesTable rows={data.rows} />
            <Pager
              basePath="/platform/workspaces"
              q={trimmedQ || undefined}
              page={data.page}
              hasNext={data.hasNext}
            />
          </>
        )}
      </section>
    </div>
  );
}
