import * as React from "react";
import Link from "next/link";
import { Button } from "../ui/button";

export interface PagerProps {
  basePath: string;
  q?: string;
  page: number;
  hasNext: boolean;
}

export function Pager({ basePath, q, page, hasNext }: PagerProps) {
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
            <Link href={buildHref(page - 1)}>Previous</Link>
          </Button>
        )}
      </div>
      <div>
        {hasNext && (
          <Button variant="outline" size="sm" asChild>
            <Link href={buildHref(page + 1)}>Next</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
