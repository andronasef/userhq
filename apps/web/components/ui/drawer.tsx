"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "../../lib/utils";

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;
export const DrawerPortal = DialogPrimitive.Portal;

export const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DrawerOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn("fixed inset-0 bg-foreground/40 z-50", className)}
      {...props}
    />
  );
});
DrawerOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(function DrawerContent({ className, children, ...props }, ref) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed inset-y-0 left-0 w-72 bg-muted border-r border-border p-4 overflow-y-auto z-50 focus:outline-none",
          className
        )}
        {...props}
      >
        <DialogPrimitive.Title className="sr-only">
          Navigation
        </DialogPrimitive.Title>
        {children}
      </DialogPrimitive.Content>
    </DrawerPortal>
  );
});
DrawerContent.displayName = DialogPrimitive.Content.displayName;
