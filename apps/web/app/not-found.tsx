import * as React from "react";
import Link from "next/link";
import { Button } from "../components/ui/button";

export const metadata = {
  title: "Page not found · UserHQ",
};

export default function NotFound(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold leading-tight">
          Page not found
        </h1>
        <p className="text-base text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
      </div>

      <div>
        <Button variant="outline" asChild>
          <Link href="/">Go to home</Link>
        </Button>
      </div>
    </div>
  );
}
