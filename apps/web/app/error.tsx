"use client";

import * as React from "react";
import { Button } from "../components/ui/button.js";

export interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({
  error,
  reset,
}: ErrorProps): React.JSX.Element {
  React.useEffect(() => {
    document.title = "Error · UserHQ";
    if (error?.digest) {
      console.error("Error digest:", error.digest);
    }
  }, [error]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold leading-tight">
          Something went wrong
        </h1>
        <p className="text-base text-muted-foreground">
          This page couldn&apos;t load. Try again, or come back in a few minutes.
        </p>
      </div>

      <div>
        <Button variant="outline" onClick={() => reset()}>
          Try again
        </Button>
      </div>
    </div>
  );
}
