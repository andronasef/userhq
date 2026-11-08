import * as React from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getMe } from "@/lib/api-server";
import { GuideView } from "@/components/guide/guide-view";

export const metadata: Metadata = {
  title: "Platform & Automation API Guide · UserHQ",
  description:
    "Interactive documentation and Swagger-style API explorer for workspace owners.",
};

export default async function GuidePage(): Promise<React.JSX.Element> {
  const me = await getMe();

  if (!me.user) {
    redirect("/login?next=/guide");
  }

  const isWorkspaceOwner =
    me.isPlatformOwner || me.workspaces.some((w) => w.role === "owner");

  if (!isWorkspaceOwner) {
    notFound();
  }

  const ownerWorkspaces = me.workspaces
    .filter((w) => me.isPlatformOwner || w.role === "owner")
    .map((w) => ({
      slug: w.slug,
      name: w.name,
      role: w.role,
    }));

  return (
    <GuideView
      workspaces={ownerWorkspaces}
      isPlatformOwner={me.isPlatformOwner}
    />
  );
}
