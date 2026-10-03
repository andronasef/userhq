"use client";

import * as React from "react";
import { useQueryStates, parseAsString, parseAsStringLiteral } from "nuqs";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

export interface BoardFiltersProps {
  categories?: { id: string; name: string }[];
  statuses?: { id: string; name: string; color: string; type: string }[];
}

export function BoardFilters({
  categories = [],
  statuses = [],
}: BoardFiltersProps): React.JSX.Element {
  const [{ q, sort, category, status }, setParams] = useQueryStates(
    {
      q: parseAsString.withDefault(""),
      sort: parseAsStringLiteral(["new", "top", "match"] as const).withDefault(
        "new"
      ),
      category: parseAsString.withDefault(""),
      status: parseAsString.withDefault(""),
      cursor: parseAsString.withDefault(""),
    },
    {
      shallow: false,
      history: "push",
    }
  );

  const [searchVal, setSearchVal] = React.useState(q);

  React.useEffect(() => {
    setSearchVal(q);
  }, [q]);

  const hasQ = q.trim() !== "";

  const commitSearch = (val: string) => {
    const trimmed = val.trim();
    if (trimmed === "") {
      void setParams({
        q: null,
        cursor: null as any,
        ...(sort === "match" ? { sort: null } : {}),
      });
    } else {
      void setParams({
        q: trimmed,
        cursor: null as any,
      });
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center mb-4">
      <div className="relative w-full sm:w-72">
        <label htmlFor="dashboard-board-search" className="sr-only">
          Search posts
        </label>
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <Input
          id="dashboard-board-search"
          type="search"
          placeholder="Search posts"
          className="pl-9 h-9"
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commitSearch(searchVal);
            }
          }}
          onBlur={() => {
            if (searchVal !== q) {
              commitSearch(searchVal);
            }
          }}
        />
      </div>

      <div className="w-full sm:w-44">
        <label htmlFor="dashboard-status-filter" className="sr-only">
          Status
        </label>
        <NativeSelect
          id="dashboard-status-filter"
          value={status}
          onChange={(e) => {
            const val = e.target.value;
            void setParams({
              status: val === "" ? null : val,
              cursor: null as any,
            });
          }}
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      {categories.length > 0 && (
        <div className="w-full sm:w-44">
          <label htmlFor="dashboard-category-filter" className="sr-only">
            Category
          </label>
          <NativeSelect
            id="dashboard-category-filter"
            value={category}
            onChange={(e) => {
              const val = e.target.value;
              void setParams({
                category: val === "" ? null : val,
                cursor: null as any,
              });
            }}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      <div className="w-full sm:w-44">
        <label htmlFor="dashboard-sort-filter" className="sr-only">
          Sort by
        </label>
        <NativeSelect
          id="dashboard-sort-filter"
          value={sort}
          onChange={(e) => {
            const val = e.target.value as "new" | "top" | "match";
            void setParams({
              sort: val === "new" ? null : val,
              cursor: null as any,
            });
          }}
        >
          {hasQ && <option value="match">Best match</option>}
          <option value="new">Newest</option>
          <option value="top">Top voted</option>
        </NativeSelect>
      </div>
    </div>
  );
}
