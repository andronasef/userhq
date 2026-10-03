import * as React from "react";
import { portalHref } from "../../lib/tenant";
import { accentTokens } from "../../lib/accent";
import { EntityLogo } from "../entity-logo";

export interface ProductCardProps {
  ws: string;
  product: {
    slug: string;
    name: string;
    tagline?: string | null;
    accentColor: string;
    logoUrl?: string | null;
  };
}

export function ProductCard({
  ws,
  product,
}: ProductCardProps): React.JSX.Element {
  const tokens = accentTokens(product.accentColor);

  return (
    <a
      href={portalHref(ws, product.slug)}
      className="rounded-lg border border-border border-t-4 p-6 flex flex-col gap-4 hover:bg-muted transition-colors"
      style={
        {
          borderTopColor: tokens.primary,
          "--entity-accent": tokens.primary,
        } as React.CSSProperties
      }
    >
      <EntityLogo
        src={product.logoUrl}
        name={product.name}
        size={40}
        style={{ "--entity-accent": tokens.primary } as React.CSSProperties}
      />
      <div className="flex flex-col gap-1 min-w-0">
        <span className="text-base font-semibold text-foreground break-words">
          {product.name}
        </span>
        {product.tagline && (
          <span className="text-sm text-muted-foreground line-clamp-2">
            {product.tagline}
          </span>
        )}
      </div>
    </a>
  );
}
