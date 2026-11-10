import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getServerI18n } from "@/lib/i18n/server";
import { getMe, getPlatformUsers } from "@/lib/api-server";
import { PlatformHeader } from "@/components/platform/platform-header";
import { UsersTable } from "@/components/platform/users-table";
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

export default async function PlatformUsersPage({
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

  const result = await getPlatformUsers(trimmedQ || undefined, page);
  const data = result.ok ? result.data : { rows: [], page: 1, hasNext: false };

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4 sm:px-6 flex flex-col gap-8">
      <PlatformHeader activeTab="/platform/users" />

      <section className="flex flex-col gap-4">
        <form method="get" className="flex items-center gap-2">
          <Input
            type="search"
            name="q"
            defaultValue={trimmedQ}
            placeholder={t("platform.searchUsersPlaceholder")}
            className="w-full sm:w-72"
          />
        </form>

        {data.rows.length === 0 ? (
          trimmedQ ? (
            <EmptyState
              title={t("platform.noUsersMatchTitle")}
              body={t("platform.noUsersMatchBody", { query: trimmedQ })}
              action={
                <Button variant="outline" asChild>
                  <Link href="/platform/users">{t("platform.clearSearch")}</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              title={t("platform.noUsersYetTitle")}
              body={t("platform.noUsersYetBody")}
            />
          )
        ) : (
          <>
            <UsersTable rows={data.rows} />
            <Pager
              basePath="/platform/users"
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
