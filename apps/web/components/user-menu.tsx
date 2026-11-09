"use client";

import * as React from "react";
import { useI18n } from "../lib/i18n/context";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ImageUp,
  LogOut,
  LoaderCircle,
  LayoutDashboard,
  ShieldCheck,
  UserCog,
  Activity,
  ArrowLeft,
  Sun,
  Moon,
  Monitor,
  Check,
  Contrast,
  BookOpen,
  Globe,
} from "lucide-react";
import { LOCALE_CATALOG } from "@userhq/types";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Avatar } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "./ui/dropdown-menu";
import { useTheme } from "./theme-provider";
import { authClient } from "../lib/auth-client";

export interface UserMenuProps {
  user: {
    name: string;
    image: string | null;
  };
  devUploadEnabled: boolean;
  hasWorkspaces?: boolean;
  isPlatformOwner?: boolean;
  isWorkspaceOwner?: boolean;
}

export function UserMenu({
  user,
  devUploadEnabled,
  hasWorkspaces = false,
  isPlatformOwner = false,
  isWorkspaceOwner = false,
}: UserMenuProps): React.JSX.Element {
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isPending, setIsPending] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const pathname = usePathname();
  const isAccountPage = pathname === "/account";
  const [accountReturnHref, setAccountReturnHref] = React.useState<string | null>(null);

  const ThemeIcon =
    theme === "system"
      ? Monitor
      : resolvedTheme === "charcoal"
      ? Contrast
      : resolvedTheme === "dark"
      ? Moon
      : Sun;

  React.useEffect(() => {
    if (pathname && pathname !== "/account" && pathname !== "/login") {
      try {
        sessionStorage.setItem("userhq_last_return", pathname);
      } catch {
        // Ignore storage errors
      }
    } else if (isAccountPage) {
      try {
        const sp = new URLSearchParams(window.location.search);
        const back = sp.get("back") || sessionStorage.getItem("userhq_last_return");
        if (back && back.startsWith("/") && back !== "/account" && back !== "/login") {
          setAccountReturnHref(back);
        }
      } catch {
        // Ignore storage errors
      }
    }
  }, [pathname, isAccountPage]);

  const portalProductMatch = pathname ? pathname.match(/^\/([^/]+)\/([^/]+)(?:\/.*)?$/) : null;
  const isPortalProduct =
    portalProductMatch &&
    !["dashboard", "platform", "account", "login", "dev", "invite", "api"].includes(portalProductMatch[1]);
  const activityHref = isPortalProduct
    ? `/${portalProductMatch[1]}/${portalProductMatch[2]}/activity`
    : null;

  const returnPortalMatch =
    isAccountPage && accountReturnHref
      ? accountReturnHref.match(/^\/([^/]+)\/([^/]+)(?:\/.*)?$/)
      : null;
  const isReturnPortal =
    returnPortalMatch &&
    !["dashboard", "platform", "account", "login", "dev", "invite", "api"].includes(
      returnPortalMatch[1]
    );

  const effectiveActivityHref =
    activityHref ||
    (isReturnPortal
      ? `/${returnPortalMatch[1]}/${returnPortalMatch[2]}/activity`
      : null);

  const accountHref =
    pathname && !isAccountPage && pathname !== "/login"
      ? `/account?back=${encodeURIComponent(pathname)}`
      : "/account";

  const handleSignOut = async () => {
    setIsPending(true);
    setErrorMessage(null);

    try {
      const res = await authClient.signOut();
      if (res?.error) {
        setIsPending(false);
        setErrorMessage("Couldn't sign out. Check your connection and try again.");
        return;
      }
      window.location.assign("/");
    } catch {
      setIsPending(false);
      setErrorMessage("Couldn't sign out. Check your connection and try again.");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={t("ui.openAccountMenu")}
        >
          <Avatar size="sm" src={user.image} name={user.name} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuLabel className="truncate max-w-48">
          {user.name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {(hasWorkspaces || isPlatformOwner) && (
          <>
            {hasWorkspaces && (
              <DropdownMenuItem asChild>
                <Link href="/dashboard" className="flex items-center gap-2 w-full">
                  <LayoutDashboard className="size-4 shrink-0" aria-hidden="true" />
                  <span>{t("nav.goToDashboard")}</span>
                </Link>
              </DropdownMenuItem>
            )}
            {isPlatformOwner && (
              <DropdownMenuItem asChild>
                <Link href="/platform" className="flex items-center gap-2 w-full">
                  <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
                  <span>{t("ui.platformConsole")}</span>
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
          </>
        )}

        {devUploadEnabled && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/dev/upload" className="flex items-center gap-2 w-full">
                <ImageUp className="size-4 shrink-0" aria-hidden="true" />
                <span>Upload test</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {isAccountPage && accountReturnHref && (
          <DropdownMenuItem asChild>
            <Link href={accountReturnHref} className="flex items-center gap-2 w-full">
              <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
              <span>
                {accountReturnHref.startsWith("/dashboard")
                  ? t("ui.backToDashboard")
                  : isReturnPortal
                  ? t("nav.backToPortal")
                  : t("common.back")}
              </span>
            </Link>
          </DropdownMenuItem>
        )}

        {effectiveActivityHref && (
          <DropdownMenuItem asChild>
            <Link href={effectiveActivityHref} className="flex items-center gap-2 w-full">
              <Activity className="size-4 shrink-0" aria-hidden="true" />
              <span>{t("ui.myActivity")}</span>
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex items-center gap-2 w-full cursor-pointer">
            <ThemeIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>{t("ui.theme")}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-36">
            <DropdownMenuItem
              onClick={() => setTheme("system")}
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Monitor className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>{t("ui.themeSystem")}</span>
              </span>
              {theme === "system" && <Check className="size-3.5 text-[var(--primary-text)] shrink-0" aria-hidden="true" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme("light")}
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Sun className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>{t("ui.themeLight")}</span>
              </span>
              {theme === "light" && <Check className="size-3.5 text-[var(--primary-text)] shrink-0" aria-hidden="true" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme("dark")}
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Moon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>{t("ui.themeDark")}</span>
              </span>
              {theme === "dark" && <Check className="size-3.5 text-[var(--primary-text)] shrink-0" aria-hidden="true" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme("charcoal")}
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Contrast className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>{t("ui.themeCharcoal")}</span>
              </span>
              {theme === "charcoal" && <Check className="size-3.5 text-[var(--primary-text)] shrink-0" aria-hidden="true" />}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex items-center gap-2 w-full cursor-pointer">
            <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>{t("common.language", "Language")}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48 max-h-72 overflow-y-auto">
            {Object.values(LOCALE_CATALOG).map((item) => {
              const isSelected = item.code === locale;
              return (
                <DropdownMenuItem
                  key={item.code}
                  onClick={() => {
                    setLocale(item.code);
                    router.refresh();
                  }}
                  className={cn(
                    "flex items-center justify-between cursor-pointer text-xs py-1.5 px-2",
                    isSelected && "font-semibold text-foreground bg-muted/60",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-foreground">{item.nativeName}</span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      ({item.name})
                    </span>
                  </div>
                  {isSelected && (
                    <Check
                      className="size-3.5 text-[var(--primary-text)] shrink-0 ml-2"
                      aria-hidden="true"
                    />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {(isWorkspaceOwner || isPlatformOwner) && (
          <DropdownMenuItem asChild>
            <Link href="/guide" className="flex items-center gap-2 w-full cursor-pointer">
              <BookOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>{t("ui.userGuide")}</span>
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem asChild>
          <Link href={accountHref} className="flex items-center gap-2 w-full">
            <UserCog className="size-4 shrink-0" aria-hidden="true" />
            <span>{t("ui.accountSettings")}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={isPending}
          onSelect={(event) => {
            event.preventDefault();
            void handleSignOut();
          }}
        >
          {isPending ? (
            <>
              <LoaderCircle
                className="size-4 animate-spin shrink-0"
                aria-hidden="true"
              />
              <span>{t("ui.signingOut")}</span>
            </>
          ) : (
            <>
              <LogOut className="size-4 shrink-0" aria-hidden="true" />
              <span>{t("ui.signOut")}</span>
            </>
          )}
        </DropdownMenuItem>

        {errorMessage && (
          <div
            role="alert"
            className="text-sm px-2 py-2 text-destructive font-normal"
          >
            {errorMessage}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SignInButton(): React.JSX.Element | null {
  const { t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pathname === "/login") {
    return null;
  }

  const search = searchParams?.toString();
  const currentPath = search ? `${pathname}?${search}` : pathname;
  const href = `/login?next=${encodeURIComponent(currentPath)}`;

  return (
    <Button variant="outline" asChild>
      <Link href={href}>{t("ui.signIn")}</Link>
    </Button>
  );
}
