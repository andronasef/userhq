"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Filter,
  Shield,
  Plus,
  Trash2,
  MessageSquare,
  ThumbsUp,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import type {
  ProductUserListItem,
  Badge,
  UserProductBadgeItem,
} from "@userhq/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Avatar } from "@/components/ui/avatar";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { BadgeChip } from "@/components/badges/badge-chip";
import { formatDate } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { QueryProvider } from "@/lib/query-client";
import { useI18n } from "@/lib/i18n/context";

export interface ProductUsersManagerProps {
  ws: string;
  product: string;
}

interface ProductUsersApiResponse {
  items: ProductUserListItem[];
  total: number;
  page: number;
  limit: number;
}

function ProductUsersManagerInner({
  ws,
  product,
}: ProductUsersManagerProps): React.JSX.Element {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();

  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [badgeFilter, setBadgeFilter] = React.useState<string>("");
  const [page, setPage] = React.useState(1);
  const [managingUser, setManagingUser] =
    React.useState<ProductUserListItem | null>(null);

  // Modal manual assignment state
  const [selectedBadgeToGrant, setSelectedBadgeToGrant] =
    React.useState<string>("");
  const [expiresAt, setExpiresAt] = React.useState<string>("");

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Load badges for filtering and modal
  const { data: badgesData } = useQuery<{ items: Badge[] }>({
    queryKey: ["product-badges", ws, product],
    queryFn: () =>
      apiFetch(`/api/v1/workspaces/${ws}/products/${product}/badges`),
  });
  const allBadges: Badge[] = badgesData?.items || [];

  // Load users list
  const usersQueryKey = [
    "product-users",
    ws,
    product,
    debouncedQuery,
    badgeFilter,
    page,
  ];

  const { data: usersData, isLoading } = useQuery<ProductUsersApiResponse>({
    queryKey: usersQueryKey,
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (debouncedQuery.trim()) {
        searchParams.set("search", debouncedQuery.trim());
      }
      if (badgeFilter) {
        searchParams.set("badgeId", badgeFilter);
      }
      searchParams.set("page", String(page));
      searchParams.set("limit", "25");
      return apiFetch(
        `/api/v1/workspaces/${ws}/products/${product}/users?${searchParams.toString()}`,
      );
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({
      userId,
      badgeId,
      expiresAtVal,
    }: {
      userId: string;
      badgeId: string;
      expiresAtVal?: string;
    }) => {
      return apiFetch(
        `/api/v1/workspaces/${ws}/products/${product}/users/${userId}/badges`,
        {
          method: "POST",
          body: {
            badgeId,
            expiresAt: expiresAtVal
              ? new Date(expiresAtVal).toISOString()
              : null,
          },
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["product-users", ws, product],
      });
      toast.success(t("productUsers.badgeGranted"));
      setSelectedBadgeToGrant("");
      setExpiresAt("");
      // Update managing user badges locally
      if (managingUser && selectedBadgeToGrant) {
        const granted = allBadges.find((b) => b.id === selectedBadgeToGrant);
        if (granted) {
          const newBadge: UserProductBadgeItem = {
            id: crypto.randomUUID(),
            badgeId: granted.id,
            name: granted.name,
            slug: granted.slug,
            description: granted.description,
            color: granted.color,
            textColor: granted.textColor,
            icon: granted.icon,
            priority: granted.priority,
            source: "manual",
            grantedAt: new Date().toISOString(),
            expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          };
          setManagingUser({
            ...managingUser,
            badges: [
              ...managingUser.badges.filter((b) => b.badgeId !== granted.id),
              newBadge,
            ],
          });
        }
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || t("productUsers.failedToGrantBadge"));
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async ({
      userId,
      badgeId,
    }: {
      userId: string;
      badgeId: string;
    }) => {
      return apiFetch(
        `/api/v1/workspaces/${ws}/products/${product}/users/${userId}/badges/${badgeId}`,
        {
          method: "DELETE",
        },
      );
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["product-users", ws, product],
      });
      toast.success(t("productUsers.badgeRevoked"));
      if (managingUser) {
        setManagingUser({
          ...managingUser,
          badges: managingUser.badges.filter(
            (b) => b.badgeId !== vars.badgeId && b.id !== vars.badgeId,
          ),
        });
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || t("productUsers.failedToRevokeBadge"));
    },
  });

  const users: ProductUserListItem[] = usersData?.items || [];
  const total = usersData?.total || 0;
  const totalPages = Math.ceil(total / 25) || 1;

  // Badges not currently assigned to managingUser
  const availableToGrant = managingUser
    ? allBadges.filter(
        (b) => !managingUser.badges.some((ub) => ub.badgeId === b.id),
      )
    : [];

  return (
    <div className="space-y-4">
      {/* Controls & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("users.searchPlaceholder")}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground shrink-0" />
          <NativeSelect
            value={badgeFilter}
            onChange={(e) => {
              setBadgeFilter(e.target.value);
              setPage(1);
            }}
            className="w-[180px]"
          >
            <option value="">{t("badges.title")}</option>
            {allBadges.map((badge) => (
              <option key={badge.id} value={badge.id}>
                {badge.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="p-12 text-center text-sm text-muted-foreground border border-border rounded-lg bg-card">
          {t("board.loading")}
        </div>
      ) : users.length === 0 ? (
        <div className="p-12 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg bg-card">
          {debouncedQuery || badgeFilter
            ? t("users.noUsersTitle")
            : t("users.noUsersBody")}
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t("users.colUser")}</TH>
              <TH>{t("users.colBadges")}</TH>
              <TH>{t("productUsers.activity")}</TH>
              <TH>{t("users.colJoined")}</TH>
              <TH className="text-right">{t("users.colActions")}</TH>
            </TR>
          </THead>
          <TBody>
            {users.map((u: ProductUserListItem) => (
              <TR key={u.id}>
                <TD>
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={u.image}
                      name={u.name || u.email || "User"}
                      size="sm"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-foreground truncate">
                        {u.name || t("productUsers.unnamedUser")}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {u.email}
                      </span>
                    </div>
                  </div>
                </TD>

                <TD>
                  <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                    {u.badges && u.badges.length > 0 ? (
                      u.badges.map((b: UserProductBadgeItem) => (
                        <BadgeChip key={b.id} badge={b} />
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        {t("common.none")}
                      </span>
                    )}
                  </div>
                </TD>

                <TD>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span
                      title={t("productUsers.postsSubmitted")}
                      className="flex items-center gap-1"
                    >
                      <FileText className="size-3.5 text-muted-foreground/70" />
                      {u.postsCount}
                    </span>
                    <span
                      title={t("productUsers.commentsWritten")}
                      className="flex items-center gap-1"
                    >
                      <MessageSquare className="size-3.5 text-muted-foreground/70" />
                      {u.commentsCount}
                    </span>
                    <span
                      title={t("productUsers.votesCast")}
                      className="flex items-center gap-1"
                    >
                      <ThumbsUp className="size-3.5 text-muted-foreground/70" />
                      {u.votesCount}
                    </span>
                  </div>
                </TD>

                <TD>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(u.firstSeenAt, locale)}
                  </span>
                </TD>

                <TD className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setManagingUser(u);
                      setSelectedBadgeToGrant("");
                      setExpiresAt("");
                    }}
                    className="gap-1.5"
                  >
                    <Shield className="size-3.5" />
                    <span>{t("badges.manageBadges")}</span>
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {t("productUsers.showingRange", {
              start: (page - 1) * 25 + 1,
              end: Math.min(page * 25, total),
              total,
            })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" />
              <span>{t("common.previous")}</span>
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              {t("productUsers.pageOf", { page, totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <span>{t("common.next")}</span>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Manage User Badges Dialog */}
      <Dialog
        open={Boolean(managingUser)}
        onOpenChange={(open) => !open && setManagingUser(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("badges.manageBadges")}</DialogTitle>
            <DialogDescription>
              {managingUser?.name || managingUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Current Badges List */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("users.colBadges")}
              </h4>
              {managingUser?.badges && managingUser.badges.length > 0 ? (
                <div className="space-y-2">
                  {managingUser.badges.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between p-2.5 rounded border border-border bg-muted/30"
                    >
                      <div className="flex items-center gap-2">
                        <BadgeChip badge={b} />
                        <span className="text-[11px] text-muted-foreground">
                          ({b.source || "manual"})
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        title={t("users.revokeBadge")}
                        disabled={revokeMutation.isPending}
                        onClick={() =>
                          managingUser &&
                          revokeMutation.mutate({
                            userId: managingUser.id,
                            badgeId: b.badgeId,
                          })
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  {t("productUsers.noBadgesAssigned")}
                </p>
              )}
            </div>

            {/* Grant Badge Form */}
            <div className="border-t border-border pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                {t("users.grantBadge")}
              </h4>

              {availableToGrant.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  {t("productUsers.allBadgesGranted")}
                </p>
              ) : (
                <div className="space-y-3">
                  <NativeSelect
                    value={selectedBadgeToGrant}
                    onChange={(e) => setSelectedBadgeToGrant(e.target.value)}
                  >
                    <option value="">{t("productUsers.selectBadge")}</option>
                    {availableToGrant.map((badge) => (
                      <option key={badge.id} value={badge.id}>
                        {badge.name} ({badge.slug})
                      </option>
                    ))}
                  </NativeSelect>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      {t("productUsers.expirationDateOptional")}
                    </label>
                    <Input
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                    />
                  </div>

                  <Button
                    size="sm"
                    className="w-full gap-1.5"
                    disabled={!selectedBadgeToGrant || assignMutation.isPending}
                    onClick={() => {
                      if (!managingUser || !selectedBadgeToGrant) return;
                      assignMutation.mutate({
                        userId: managingUser.id,
                        badgeId: selectedBadgeToGrant,
                        expiresAtVal: expiresAt || undefined,
                      });
                    }}
                  >
                    <Plus className="size-4" />
                    <span>
                      {assignMutation.isPending ? t("productUsers.granting") : t("users.grantBadge")}
                    </span>
                  </Button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManagingUser(null)}>
              {t("common.done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ProductUsersManager(
  props: ProductUsersManagerProps,
): React.JSX.Element {
  return (
    <QueryProvider>
      <ProductUsersManagerInner {...props} />
    </QueryProvider>
  );
}
