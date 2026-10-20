import { cn } from "../lib/utils";

/** The supplied UserHQ identity. Tenant logos belong to EntityLogo instead. */
export function UserHQBrand({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "userhq-brand inline-flex items-center gap-2 text-xl leading-none",
        className,
      )}
      aria-label="UserHQ"
    >
      <img
        src="/brand/userhq-mark.svg"
        alt=""
        width={32}
        height={32}
        className={cn("shrink-0", compact ? "size-5" : "size-8")}
      />
      <span aria-hidden="true">
        User<span className="userhq-brand-accent">HQ</span>
      </span>
    </span>
  );
}
