"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeft, X } from "lucide-react";
import { Button } from "../ui/button";
import { Drawer, DrawerTrigger, DrawerContent, DrawerClose } from "../ui/drawer";

interface MobileNavProps {
  children: React.ReactNode;
}

export function MobileNav({ children }: MobileNavProps) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden shrink-0"
          aria-label="Open navigation"
        >
          <PanelLeft className="size-5 shrink-0" aria-hidden="true" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
          <Link
            href="/dashboard"
            className="text-base font-semibold text-foreground"
            onClick={() => setOpen(false)}
          >
            UserHQ
          </Link>
          <DrawerClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-md text-muted-foreground hover:text-foreground"
              aria-label="Close navigation"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </DrawerClose>
        </div>
        <div
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) {
              setOpen(false);
            }
          }}
        >
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
