import * as React from "react";
import { CircleAlert } from "lucide-react";

export interface FieldProps {
  id: string;
  label: string;
  helper?: string;
  error?: string;
  children: React.ReactElement<any>;
}

export function Field({
  id,
  label,
  helper,
  error,
  children,
}: FieldProps): React.JSX.Element {
  const helperId = `${id}-help`;
  const errorId = `${id}-error`;

  const describedBy = error
    ? errorId
    : helper
      ? helperId
      : undefined;

  const child = React.isValidElement(children)
    ? React.cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": !!error || undefined,
      } as any)
    : children;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      {child}
      {error ? (
        <p id={errorId} className="flex items-center gap-1.5 text-sm font-normal text-destructive">
          <CircleAlert className="size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : helper ? (
        <p id={helperId} className="text-sm font-normal text-muted-foreground">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
