"use client";

import * as React from "react";
import { useI18n } from "../../lib/i18n/context";
import { useQueryStates, parseAsString, parseAsStringLiteral } from "nuqs";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "../ui/input";
import { NativeSelect } from "../ui/native-select";
import { Button } from "../ui/button";

export interface BoardToolbarProps {
  categories?: { id: string; name: string }[];
  statuses?: { id: string; name: string; color: string; type: string }[];
}

export function BoardToolbar({
  categories = [],
  statuses = [],
}: BoardToolbarProps): React.JSX.Element {
  const { t } = useI18n();
  const [{ q, sort, category, status }, setParams] = useQueryStates(
    {
      q: parseAsString.withDefault(""),
      sort: parseAsStringLiteral(["top", "new", "match"] as const).withDefault(
        "top"
      ),
      category: parseAsString.withDefault(""),
      status: parseAsString.withDefault(""),
    },
    {
      shallow: false,
      history: "push",
    }
  );

  const [searchVal, setSearchVal] = React.useState(q);
  const [isFiltersOpen, setIsFiltersOpen] = React.useState(false);

  React.useEffect(() => {
    setSearchVal(q);
  }, [q]);

  const hasQ = q.trim() !== "";
  const defaultSort = hasQ ? "match" : "top";
  const currentSort = sort === "top" ? (hasQ ? "top" : "top") : sort === "new" ? "new" : (hasQ ? "match" : "top");

  const isSortNonDefault = hasQ ? (sort === "top" || sort === "new") : sort === "new";
  const isCategoryNonDefault = Boolean(category);
  const isStatusNonDefault = Boolean(status);
  const diffCount =
    (isSortNonDefault ? 1 : 0) +
    (isCategoryNonDefault ? 1 : 0) +
    (isStatusNonDefault ? 1 : 0);

  const commitSearch = (val: string) => {
    const trimmed = val.trim();
    if (trimmed === "") {
      void setParams({
        q: null,
        ...(sort === "match" ? { sort: null } : {}),
      });
    } else {
      void setParams({
        q: trimmed,
      });
    }
  };

  const renderSortSelect = (id: string) => (
    <div className="w-full sm:w-40">
      <label htmlFor={id} className="sr-only">
        {t("portal.sortBy")}
      </label>
      <NativeSelect
        id={id}
        value={currentSort}
        onChange={(e) => {
          const val = e.target.value as "top" | "new" | "match";
          void setParams({ sort: val === defaultSort ? null : val });
        }}
      >
        {hasQ && <option value="match">{t("ui.bestMatch")}</option>}
        <option value="top">{t("ui.topVoted")}</option>
        <option value="new">{t("portal.newest")}</option>
      </NativeSelect>
    </div>
  );

  const renderCategorySelect = (id: string) => {
    if (!categories || categories.length === 0) return null;
    return (
      <div className="w-full sm:w-40">
        <label htmlFor={id} className="sr-only">
          {t("ui.category")}
        </label>
        <NativeSelect
          id={id}
          value={category}
          onChange={(e) => {
            const val = e.target.value;
            void setParams({ category: val === "" ? null : val });
          }}
        >
          <option value="">{t("portal.allCategories")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </div>
    );
  };

  const renderStatusSelect = (id: string) => (
    <div className="w-full sm:w-40">
      <label htmlFor={id} className="sr-only">
        {t("ui.status")}
      </label>
      <NativeSelect
        id={id}
        value={status}
        onChange={(e) => {
          const val = e.target.value;
          void setParams({ status: val === "" ? null : val });
        }}
      >
        <option value="">{t("ui.openStatus")}</option>
        <option value="all">{t("ui.allStatuses")}</option>
        {statuses.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <label htmlFor="board-search-input" className="sr-only">
            {t("ui.searchPosts")}
          </label>
          <Input
            id="board-search-input"
            type="search"
            placeholder={t("ui.searchPosts")}
            value={searchVal}
            onChange={(e) => {
              const nextVal = e.target.value;
              setSearchVal(nextVal);
              if (nextVal === "" && q !== "") {
                commitSearch("");
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitSearch(searchVal);
              }
            }}
            className="pl-9"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          aria-expanded={isFiltersOpen}
          aria-controls="board-filters-panel"
          onClick={() => setIsFiltersOpen((prev) => !prev)}
          className="sm:hidden shrink-0"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          <span>{diffCount > 0 ? `${t("ui.filters")} · ${diffCount}` : t("ui.filters")}</span>
        </Button>

        <div className="hidden sm:flex sm:items-center sm:gap-2 shrink-0">
          {renderSortSelect("board-sort-select")}
          {renderCategorySelect("board-category-select")}
          {renderStatusSelect("board-status-select")}
        </div>
      </div>

      {isFiltersOpen && (
        <div
          id="board-filters-panel"
          className="flex flex-col gap-2 sm:hidden pt-1"
        >
          {renderSortSelect("board-mobile-sort-select")}
          {renderCategorySelect("board-mobile-category-select")}
          {renderStatusSelect("board-mobile-status-select")}
        </div>
      )}
    </div>
  );
}
