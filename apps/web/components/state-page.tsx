import * as React from "react";

export interface StatePageProps {
  title: string;
  body: string;
  actions?: React.ReactNode;
}

export function StatePage({
  title,
  body,
  actions,
}: StatePageProps): React.JSX.Element {
  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold leading-tight text-foreground">
        {title}
      </h1>
      <p className="mt-2 text-base text-muted-foreground">
        {body}
      </p>
      {actions && (
        <div className="mt-6 flex flex-wrap gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
