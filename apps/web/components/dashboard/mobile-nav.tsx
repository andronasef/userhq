"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { PanelLeft } from "lucide-react";
import { Button } from "../ui/button";
import { Drawer, DrawerTrigger, DrawerContent } from "../ui/drawer";

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
        {children}
      </DrawerContent>
    </Drawer>
  );
}
