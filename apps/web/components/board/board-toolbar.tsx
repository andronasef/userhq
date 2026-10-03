"use client";

import * as React from "react";
import { useQueryStates, parseAsStringLiteral } from "nuqs";
import { NativeSelect } from "../ui/native-select";

export interface BoardToolbarProps {
  categories?: { id: string; name: string }[];
  statuses?: { id: string; name: string; color: string; type: string }[];
}

export function BoardToolbar(_props: BoardToolbarProps): React.JSX.Element {
  const [{ sort }, setParams] = useQueryStates(
    {
      sort: parseAsStringLiteral(["top", "new", "match"] as const).withDefault(
        "top"
      ),
    },
    {
      shallow: false,
      history: "push",
    }
  );

  return (
    <div className="flex items-center justify-end gap-3">
      <div className="w-auto min-w-[130px]">
        <label htmlFor="board-sort-select" className="sr-only">
          Sort by
        </label>
        <NativeSelect
          id="board-sort-select"
          value={sort}
          onChange={(e) => {
            const val = e.target.value as "top" | "new" | "match";
            void setParams({ sort: val });
          }}
        >
          <option value="top">Top voted</option>
          <option value="new">Newest</option>
        </NativeSelect>
      </div>
    </div>
  );
}
