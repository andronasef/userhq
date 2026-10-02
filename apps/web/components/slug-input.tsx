import * as React from "react";
import { Input, type InputProps } from "./ui/input";

export interface SlugInputProps extends Omit<InputProps, "prefix"> {
  prefix: string;
}

export const SlugInput = React.forwardRef<HTMLInputElement, SlugInputProps>(
  ({ prefix, className = "", ...props }, ref) => {
    return (
      <div className="flex w-full items-stretch">
        <span className="flex select-none items-center bg-muted border border-r-0 border-input rounded-l-md px-3 text-sm text-muted-foreground whitespace-nowrap">
          {prefix}
        </span>
        <Input
          ref={ref}
          className={`rounded-l-none font-mono ${className}`}
          {...props}
        />
      </div>
    );
  }
);
SlugInput.displayName = "SlugInput";
