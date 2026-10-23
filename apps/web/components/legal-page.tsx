import * as React from "react";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <article className="mx-auto w-full max-w-2xl py-8 sm:py-12 text-sm leading-relaxed text-muted-foreground [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_strong]:text-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="text-xs">Last updated {updated}</p>
      {children}
    </article>
  );
}
