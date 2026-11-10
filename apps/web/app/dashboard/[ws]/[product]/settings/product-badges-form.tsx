"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Key } from "lucide-react";
import { toast } from "sonner";
import type { Badge, BadgeRule } from "@userhq/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { BadgeChip } from "@/components/badges/badge-chip";
import { apiFetch } from "@/lib/api-client";
import { QueryProvider } from "@/lib/query-client";
import { useI18n } from "@/lib/i18n/context";

export interface ProductBadgesFormProps {
  ws: string;
  product: { slug: string; name: string };
}

const AVAILABLE_ICONS = [
  "crown",
  "sparkles",
  "shield",
  "star",
  "award",
  "zap",
  "flame",
  "heart",
  "medal",
  "verified",
  "gem",
  "tag",
];

function ProductBadgesFormInner({
  ws,
  product,
}: ProductBadgesFormProps): React.JSX.Element {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const queryKey = ["product-badges", ws, product.slug];

  const { data, isLoading } = useQuery<{ items: Badge[] }>({
    queryKey,
    queryFn: () =>
      apiFetch(`/api/v1/workspaces/${ws}/products/${product.slug}/badges`),
  });

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editingBadge, setEditingBadge] = React.useState<Badge | null>(null);
  const [ruleBadge, setRuleBadge] = React.useState<Badge | null>(null);

  // Form states for Create/Edit
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [color, setColor] = React.useState("#e0e7ff");
  const [textColor, setTextColor] = React.useState("#3730a3");
  const [icon, setIcon] = React.useState("star");
  const [priority, setPriority] = React.useState("10");

  // Form state for Adding Rule
  const [keyMatchType, setKeyMatchType] = React.useState<"exact" | "regex">(
    "exact",
  );
  const [paramKey, setParamKey] = React.useState("");
  const [matchType, setMatchType] = React.useState<"exact" | "regex">("exact");
  const [matchValue, setMatchValue] = React.useState("");
  const [secretToken, setSecretToken] = React.useState("");

  const resetForm = () => {
    setName("");
    setSlug("");
    setDescription("");
    setColor("#e0e7ff");
    setTextColor("#3730a3");
    setIcon("star");
    setPriority("10");
  };

  const openCreate = () => {
    resetForm();
    setEditingBadge(null);
    setCreateDialogOpen(true);
  };

  const openEdit = (b: Badge) => {
    setEditingBadge(b);
    setName(b.name);
    setSlug(b.slug);
    setDescription(b.description || "");
    setColor(b.color);
    setTextColor(b.textColor);
    setIcon(b.icon || "star");
    setPriority(String(b.priority));
    setCreateDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingBadge) {
        return apiFetch(
          `/api/v1/workspaces/${ws}/products/${product.slug}/badges/${editingBadge.id}`,
          {
            method: "PATCH",
            body: {
              name,
              slug,
              description: description || null,
              color,
              textColor,
              icon: icon || null,
              priority: parseInt(priority, 10) || 0,
            },
          },
        );
      } else {
        return apiFetch(
          `/api/v1/workspaces/${ws}/products/${product.slug}/badges`,
          {
            method: "POST",
            body: {
              name,
              slug,
              description: description || undefined,
              color,
              textColor,
              icon: icon || null,
              priority: parseInt(priority, 10) || 0,
            },
          },
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(t("badges.badgeSaved"));
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save badge");
    },
  });

  const deleteBadgeMutation = useMutation({
    mutationFn: (badgeId: string) =>
      apiFetch(
        `/api/v1/workspaces/${ws}/products/${product.slug}/badges/${badgeId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(t("badges.badgeDeleted"));
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete badge");
    },
  });

  const addRuleMutation = useMutation({
    mutationFn: (badgeId: string) =>
      apiFetch(
        `/api/v1/workspaces/${ws}/products/${product.slug}/badges/${badgeId}/rules`,
        {
          method: "POST",
          body: {
            paramKey,
            keyMatchType,
            matchType,
            matchValue,
            secretToken: secretToken.trim() || undefined,
          },
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Attribution rule added");
      setParamKey("");
      setKeyMatchType("exact");
      setMatchValue("");
      setSecretToken("");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to add rule");
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: ({ badgeId, ruleId }: { badgeId: string; ruleId: string }) =>
      apiFetch(
        `/api/v1/workspaces/${ws}/products/${product.slug}/badges/${badgeId}/rules/${ruleId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Rule removed");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to remove rule");
    },
  });

  const badges = data?.items || [];

  return (
    <section aria-labelledby="badges-heading" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2
            id="badges-heading"
            className="text-base font-semibold text-foreground"
          >
            {t("badges.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("badges.description")}
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5 shrink-0">
          <Plus className="size-4" />
          <span>{t("badges.createBadge")}</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          {t("board.loading")}
        </div>
      ) : badges.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("badges.noBadgesBody")}
        </div>
      ) : (
        <div className="grid gap-3">
          {badges.map((badge: Badge) => (
            <div
              key={badge.id}
              className="rounded-lg border border-border bg-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <BadgeChip badge={badge} />
                  <span className="text-xs font-mono text-muted-foreground">
                    slug: {badge.slug}
                  </span>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                    priority: {badge.priority}
                  </span>
                </div>
                {badge.description && (
                  <p className="text-xs text-muted-foreground">
                    {badge.description}
                  </p>
                )}
                {badge.rules && badge.rules.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-xs font-medium text-foreground">
                      {t("badges.rulesTitle")}:
                    </span>
                    {badge.rules.map((rule: BadgeRule) => (
                      <span
                        key={rule.id}
                        className="inline-flex items-center gap-1 text-[11px] bg-muted/80 text-foreground px-2 py-0.5 rounded font-mono"
                      >
                        ?
                        {rule.keyMatchType === "regex"
                          ? `/${rule.paramKey}/`
                          : rule.paramKey}
                        =
                        {rule.matchType === "regex"
                          ? `/${rule.matchValue}/`
                          : rule.matchValue}
                        {rule.hasSecretToken && (
                          <span
                            title="HMAC verified"
                            className="text-foreground font-bold"
                          >
                            *
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRuleBadge(badge)}
                >
                  {t("badges.rulesTitle")} ({badge.rules?.length || 0})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(badge)}
                >
                  {t("common.edit")}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`${t("badges.deleteBadgeTitle")} "${badge.name}"?`)) {
                      deleteBadgeMutation.mutate(badge.id);
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Badge Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBadge ? t("badges.editBadge") : t("badges.createBadge")}
            </DialogTitle>
            <DialogDescription>
              {t("badges.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-center p-4 bg-muted/30 border border-border rounded-md">
              <BadgeChip
                badge={{
                  id: "preview",
                  name: name || "Preview Badge",
                  slug: slug || "preview",
                  color: color || "#e0e7ff",
                  textColor: textColor || "#3730a3",
                  icon: icon || null,
                  priority: parseInt(priority, 10) || 0,
                }}
                size="md"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="badge-name"
                className="text-sm font-semibold text-foreground"
              >
                {t("badges.badgeNameLabel")}
              </label>
              <Input
                id="badge-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editingBadge && !slug) {
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-+|-+$/g, ""),
                    );
                  }
                }}
                placeholder="e.g. VIP Customer, Beta Tester"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="badge-slug"
                className="text-sm font-semibold text-foreground"
              >
                Slug (unique identifier)
              </label>
              <Input
                id="badge-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="e.g. vip-customer"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="badge-desc"
                className="text-sm font-semibold text-foreground"
              >
                Description (internal note)
              </label>
              <Input
                id="badge-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Granted to top tier patrons"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="badge-bg-color"
                  className="text-sm font-semibold text-foreground"
                >
                  {t("badges.badgeColorLabel")}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="size-8 rounded border border-border cursor-pointer p-0 bg-transparent shrink-0"
                  />
                  <Input
                    id="badge-bg-color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="badge-text-color"
                  className="text-sm font-semibold text-foreground"
                >
                  Text Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="size-8 rounded border border-border cursor-pointer p-0 bg-transparent shrink-0"
                  />
                  <Input
                    id="badge-text-color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="badge-icon"
                  className="text-sm font-semibold text-foreground"
                >
                  {t("badges.badgeIconLabel")}
                </label>
                <NativeSelect
                  id="badge-icon"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                >
                  {AVAILABLE_ICONS.map((ic) => (
                    <option key={ic} value={ic}>
                      {ic}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="badge-priority"
                  className="text-sm font-semibold text-foreground"
                >
                  Priority (Higher = First)
                </label>
                <Input
                  id="badge-priority"
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  min="0"
                  max="1000"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !name.trim() || !slug.trim()}
            >
              {saveMutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rules Configuration Dialog */}
      <Dialog
        open={Boolean(ruleBadge)}
        onOpenChange={(open) => !open && setRuleBadge(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Attribution Rules: {ruleBadge?.name}</DialogTitle>
            <DialogDescription>
              Automatically grant this badge when users arrive via links with
              matching query parameters.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("badges.rulesTitle")}
              </h4>
              {ruleBadge &&
              badges.find((b) => b.id === ruleBadge.id)?.rules?.length ? (
                <div className="space-y-2">
                  {badges
                    .find((b) => b.id === ruleBadge.id)!
                    .rules?.map((r: BadgeRule) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between p-2.5 rounded border border-border bg-muted/40 text-xs"
                      >
                        <div className="space-y-0.5 font-mono">
                          <div>
                            <span className="text-foreground font-semibold">
                              ?
                              {r.keyMatchType === "regex"
                                ? `/${r.paramKey}/`
                                : r.paramKey}
                            </span>{" "}
                            {r.matchType === "regex" ? "=~" : "=="}{" "}
                            <span className="font-semibold text-foreground">
                              &quot;{r.matchValue}&quot;
                            </span>
                          </div>
                          {r.hasSecretToken && (
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Key className="size-3" />
                              <span>HMAC verification enabled</span>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() =>
                            deleteRuleMutation.mutate({
                              badgeId: ruleBadge.id,
                              ruleId: r.id,
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
                  No automated attribution rules yet.
                </p>
              )}
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Add Rule
              </h4>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <label
                    htmlFor="rule-key-match-type"
                    className="text-sm font-medium"
                  >
                    Parameter name matching
                  </label>
                  <NativeSelect
                    id="rule-key-match-type"
                    value={keyMatchType}
                    onChange={(event) =>
                      setKeyMatchType(event.target.value as "exact" | "regex")
                    }
                  >
                    <option value="exact">Exact name</option>
                    <option value="regex">Regular expression</option>
                  </NativeSelect>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="rule-param-key"
                    className="text-sm font-semibold text-foreground"
                  >
                    Query Param Name
                  </label>
                  <Input
                    id="rule-param-key"
                    value={paramKey}
                    onChange={(e) => setParamKey(e.target.value)}
                    placeholder="e.g. tier, plan, source"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="rule-match-type"
                    className="text-sm font-semibold text-foreground"
                  >
                    Match Type
                  </label>
                  <NativeSelect
                    id="rule-match-type"
                    value={matchType}
                    onChange={(e) =>
                      setMatchType(e.target.value as "exact" | "regex")
                    }
                  >
                    <option value="exact">Exact string</option>
                    <option value="regex">Regular expression</option>
                  </NativeSelect>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="rule-match-value"
                  className="text-sm font-semibold text-foreground"
                >
                  Expected Value
                </label>
                <Input
                  id="rule-match-value"
                  value={matchValue}
                  onChange={(e) => setMatchValue(e.target.value)}
                  placeholder={
                    matchType === "regex" ? "^(pro|enterprise)$" : "pro"
                  }
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="rule-secret-token"
                  className="text-sm font-semibold text-foreground"
                >
                  Anti-Spoofing HMAC Secret (Optional)
                </label>
                <Input
                  id="rule-secret-token"
                  type="password"
                  value={secretToken}
                  onChange={(e) => setSecretToken(e.target.value)}
                  placeholder="Enter secret token for HMAC-SHA256 checking"
                />
                <p className="text-[11px] text-muted-foreground">
                  When set, include both signature and timestamp parameters.
                  <code>{paramKey || "param"}_sig</code> is the HMAC-SHA256 hex
                  of
                  <code>value + "." + {paramKey || "param"}_ts</code>.
                  <code>{paramKey || "param"}_ts</code> is the Unix seconds when
                  the link was signed, valid for 30 days.
                </p>
              </div>

              <Button
                size="sm"
                onClick={() =>
                  ruleBadge && addRuleMutation.mutate(ruleBadge.id)
                }
                disabled={
                  addRuleMutation.isPending ||
                  !paramKey.trim() ||
                  !matchValue.trim()
                }
                className="w-full gap-1.5"
              >
                <Plus className="size-4" />
                <span>{t("badges.addRule")}</span>
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleBadge(null)}>
              {t("common.done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function ProductBadgesForm(
  props: ProductBadgesFormProps,
): React.JSX.Element {
  return (
    <QueryProvider>
      <ProductBadgesFormInner {...props} />
    </QueryProvider>
  );
}
