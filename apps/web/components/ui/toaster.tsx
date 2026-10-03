"use client";

import * as React from "react";
import { Toaster, toast } from "sonner";

const FLASH_KEY = "userhq:flash";

export function flash(message: string): void {
  try {
    sessionStorage.setItem(FLASH_KEY, message);
  } catch {
    // sessionStorage unavailable
  }
}

export function AppToaster(): React.JSX.Element {
  React.useEffect(() => {
    try {
      const msg = sessionStorage.getItem(FLASH_KEY);
      if (msg) {
        sessionStorage.removeItem(FLASH_KEY);
        toast.success(msg);
      }
    } catch {
      // sessionStorage unavailable
    }
  }, []);

  return (
    <Toaster
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "bg-background border-border text-foreground text-sm",
        },
      }}
    />
  );
}
