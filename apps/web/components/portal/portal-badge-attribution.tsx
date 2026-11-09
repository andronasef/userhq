"use client";
import * as React from "react";
import { AttributeResponseSchema } from "@userhq/types";
import { apiFetch } from "@/lib/api-client";
import { readAttributionParams, stripParams } from "@/lib/attribution";

export interface PortalBadgeAttributionProps {
  ws: string;
  product: string;
}
export function PortalBadgeAttribution({
  ws,
  product,
}: PortalBadgeAttributionProps): null {
  React.useEffect(() => {
    const { params, signatureKeys } = readAttributionParams(
      window.location.search,
    );
    if (signatureKeys.length)
      window.history.replaceState(
        window.history.state,
        "",
        stripParams(window.location, signatureKeys),
      );
    void apiFetch(
      `/api/v1/portal/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/badges/attribute`,
      {
        method: "POST",
        body: { searchParams: params },
        schema: AttributeResponseSchema,
      },
    )
      .then((data) => {
        if (data.scrubKeys.length)
          window.history.replaceState(
            window.history.state,
            "",
            stripParams(window.location, data.scrubKeys),
          );
      })
      .catch(() => {
        /* Attribution must never interrupt the portal. */
      });
  }, [ws, product]);
  return null;
}
