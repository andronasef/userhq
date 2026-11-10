"use client";

import * as React from "react";
import { Button } from "../components/ui/button";
import { useI18n } from "@/lib/i18n/context";

export interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({
  error,
  reset,
}: ErrorProps): React.JSX.Element {
  const { t } = useI18n();

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
          {t("errors.somethingWentWrong")}
        </h1>
        <p className="text-base text-muted-foreground">
          {t("errors.pageCouldNotLoad")}
        </p>
      </div>

      <div>
        <Button variant="outline" onClick={() => reset()}>
          {t("errors.tryAgain")}
        </Button>
      </div>
    </div>
  );
}
