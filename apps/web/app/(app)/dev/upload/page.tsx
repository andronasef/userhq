import * as React from "react";
import { notFound, redirect } from "next/navigation";
import { isDevUploadEnabled } from "../../../../lib/dev-flags";
import { getMe } from "../../../../lib/api-server";
import { QueryProvider } from "../../../../lib/query-client";
import { getRequestLocale, getDictionary } from "../../../../lib/i18n/server";
import { UploadForm } from "./upload-form";

export async function generateMetadata() {
  const locale = await getRequestLocale();
  const dict = await getDictionary(locale);
  return {
    title: `${dict.devUpload.title} · UserHQ`,
  };
}

export default async function DevUploadPage(): Promise<React.JSX.Element> {
  if (!isDevUploadEnabled()) {
    notFound();
  }

  const { user } = await getMe();
  if (!user) {
    redirect("/login?next=%2Fdev%2Fupload");
  }

  const locale = await getRequestLocale();
  const dict = await getDictionary(locale);

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold leading-tight">
            {dict.devUpload.title}
          </h1>
          <span className="text-sm font-semibold bg-muted rounded-md px-2 py-0.5 text-muted-foreground">
            {dict.devUpload.devOnly}
          </span>
        </div>
        <p className="text-base text-muted-foreground">
          {dict.devUpload.description}
        </p>
      </div>

      <QueryProvider>
        <UploadForm />
      </QueryProvider>
    </div>
  );
}
