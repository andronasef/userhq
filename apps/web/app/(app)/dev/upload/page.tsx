import * as React from "react";
import { notFound, redirect } from "next/navigation";
import { isDevUploadEnabled } from "../../../../lib/dev-flags";
import { getMe } from "../../../../lib/api-server";
import { QueryProvider } from "../../../../lib/query-client";
import { UploadForm } from "./upload-form";

export const metadata = {
  title: "Upload test · UserHQ",
};

export default async function DevUploadPage(): Promise<React.JSX.Element> {
  if (!isDevUploadEnabled()) {
    notFound();
  }

  const { user } = await getMe();
  if (!user) {
    redirect("/login?next=%2Fdev%2Fupload");
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold leading-tight">
            Upload test
          </h1>
          <span className="text-sm font-semibold bg-muted rounded-md px-2 py-0.5 text-muted-foreground">
            Dev only
          </span>
        </div>
        <p className="text-base text-muted-foreground">
          Checks the image pipeline end to end. PNG, JPEG, WebP, and GIF files up to 2 MB are accepted. Each upload is converted to WebP, resized to at most 1600 px wide, and stripped of metadata. Animated GIFs keep only their first frame.
        </p>
      </div>

      <QueryProvider>
        <UploadForm />
      </QueryProvider>
    </div>
  );
}
