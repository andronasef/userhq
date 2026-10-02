"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { User } from "lucide-react";
import { cn } from "../../lib/utils.js";
import { initials } from "../../lib/initials.js";

export interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  src?: string | null;
  name?: string;
  size?: "sm" | "lg";
}

export const AvatarRoot = AvatarPrimitive.Root;
export const AvatarImage = AvatarPrimitive.Image;
export const AvatarFallback = AvatarPrimitive.Fallback;

export const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(function Avatar(
  { src, name = "", size = "sm", className, ...props },
  ref
) {
  const letters = initials(name);

  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full bg-muted",
        size === "lg" ? "size-16" : "size-8",
        className
      )}
      {...props}
    >
      {src && (
        <AvatarPrimitive.Image
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          className="aspect-square size-full object-cover"
        />
      )}
      <AvatarPrimitive.Fallback
        delayMs={300}
        className="flex size-full items-center justify-center font-semibold text-muted-foreground"
      >
        {letters ? (
          <span className={size === "lg" ? "text-2xl" : "text-sm"}>
            {letters}
          </span>
        ) : (
          <User
            className={size === "lg" ? "size-8" : "size-4"}
            aria-hidden="true"
          />
        )}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
});
Avatar.displayName = "Avatar";
