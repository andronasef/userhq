"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { usePortalAccent } from "../portal/portal-accent-context";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(function DropdownMenuSubTrigger({ className, inset, children, ...props }, ref) {
  const Comp = DropdownMenuPrimitive.SubTrigger ?? "div";
  return (
    <Comp
      ref={ref as any}
      className={cn(
        "h-9 px-2 gap-2 rounded-md text-sm outline-none data-[highlighted]:bg-muted data-[state=open]:bg-muted data-[disabled]:opacity-50 data-[disabled]:pointer-events-none flex items-center cursor-default select-none",
        inset && "pl-8",
        className
      )}
      {...(props as any)}
    >
      {children}
      <ChevronRight className="ml-auto size-4" />
    </Comp>
  );
});
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";

export const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(function DropdownMenuSubContent({ className, style, ...props }, ref) {
  const portalAccent = usePortalAccent();
  const SubContentComp = DropdownMenuPrimitive.SubContent ?? "div";
  const PortalComp = DropdownMenuPrimitive.Portal ?? React.Fragment;

  return (
    <PortalComp>
      <SubContentComp
        ref={ref as any}
        style={{ ...portalAccent, ...style }}
        className={cn(
          "motion-menu min-w-40 p-1 bg-popover text-popover-foreground border border-border rounded-lg shadow-md z-50 overflow-hidden",
          className
        )}
        {...(props as any)}
      />
    </PortalComp>
  );
});
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(function DropdownMenuContent(
  { className, align = "end", sideOffset = 8, collisionPadding = 8, style, ...props },
  ref,
) {
  const portalAccent = usePortalAccent();

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        style={{ ...portalAccent, ...style }}
        className={cn(
          "motion-menu min-w-56 max-w-[calc(100vw-1rem)] p-1 bg-popover text-popover-foreground border border-border rounded-lg shadow-md z-50 overflow-hidden",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
});
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(function DropdownMenuItem({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        "h-9 px-2 gap-2 rounded-md text-sm outline-none data-[highlighted]:bg-muted data-[disabled]:opacity-50 data-[disabled]:pointer-events-none flex items-center cursor-default select-none",
        className,
      )}
      {...props}
    />
  );
});
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

export const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(function DropdownMenuLabel({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn("px-2 py-1.5 text-sm font-semibold", className)}
      {...props}
    />
  );
});
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={cn("my-1 h-px bg-border", className)}
      {...props}
    />
  );
});
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;
