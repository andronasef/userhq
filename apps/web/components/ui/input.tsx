import * as React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={`h-9 w-full rounded-md border border-input bg-background px-3 text-base sm:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:border-destructive disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground read-only:bg-muted read-only:text-muted-foreground ${className}`}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
