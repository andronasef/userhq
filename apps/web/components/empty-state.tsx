import * as React from "react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
  as?: "h1" | "h2";
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  as: HeadingTag = "h2",
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="border border-dashed border-border rounded-lg p-8 flex flex-col items-center text-center gap-2">
      {icon && (
        <div className="size-6 text-muted-foreground flex items-center justify-center">
          {icon}
        </div>
      )}
      <HeadingTag className="text-base font-semibold text-foreground">
        {title}
      </HeadingTag>
      {body && (
        <p className="text-sm text-muted-foreground max-w-sm">
          {body}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
