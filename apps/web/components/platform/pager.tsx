"use client";

import * as React from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "../ui/button";

export interface PagerProps {
  basePath: string;
  q?: string;
  page: number;
  hasNext: boolean;
}

export function Pager({ basePath, q, page, hasNext }: PagerProps) {
  const { t } = useI18n();

  if (page <= 1 && !hasNext) {
    return null;
  }

  const buildHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="flex items-center justify-between pt-4">
      <div>
        {page > 1 && (
          <Button variant="outline" size="sm" asChild>
            <Link href={buildHref(page - 1)}>{t("common.previous")}</Link>
          </Button>
        )}
      </div>
      <div>
        {hasNext && (
          <Button variant="outline" size="sm" asChild>
            <Link href={buildHref(page + 1)}>{t("common.next")}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
