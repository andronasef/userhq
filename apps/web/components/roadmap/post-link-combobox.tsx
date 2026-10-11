"use client";

import * as React from "react";
import { Search, LoaderCircle, ChevronUp } from "lucide-react";
import {
  type RoadmapPostLinkSearchResult,
  type RoadmapPostLinkSearchResponse,
  type Status,
  RoadmapPostLinkSearchResponseSchema,
} from "@userhq/types";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { apiFetch } from "../../lib/api-client";

export interface PostLinkComboboxProps {
  ws: string;
  product: string;
  statuses: Status[];
  linkedPostIds: string[];
  onSelectPost: (post: RoadmapPostLinkSearchResult) => void;
}

export function PostLinkCombobox({
  ws,
  product,
  statuses,
  linkedPostIds,
  onSelectPost,
}: PostLinkComboboxProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<RoadmapPostLinkSearchResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Debounced search
  React.useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await apiFetch<RoadmapPostLinkSearchResponse>(
          `/api/v1/workspaces/${ws}/products/${product}/roadmap/search-posts?q=${encodeURIComponent(query.trim())}`,
          { schema: RoadmapPostLinkSearchResponseSchema }
        );
        setResults(data.posts);
        setIsOpen(true);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, ws, product]);

  // Click outside to close dropdown
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder="Search feedback posts by title or number…"
          className="pl-9 pr-9"
        />
        {isLoading && (
          <LoaderCircle
            className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </div>

      {isOpen && query.trim().length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-md p-1">
          {results.length === 0 && !isLoading ? (
            <div className="p-3 text-center text-xs text-muted-foreground">
              No matching posts found.
            </div>
          ) : (
            results.map((post) => {
              const isAlreadyLinkedHere = linkedPostIds.includes(post.id);
              const isLinkedElsewhere =
                post.roadmapItemId !== null && !isAlreadyLinkedHere;
              const isDisabled = isAlreadyLinkedHere || isLinkedElsewhere;
              const status = statuses.find((s) => s.id === post.statusId);

              return (
                <button
                  key={post.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    onSelectPost(post);
                    setQuery("");
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left rounded-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex items-center gap-0.5 text-xs font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                      <ChevronUp className="size-3" aria-hidden="true" />
                      {post.voteCount}
                    </span>
                    <span className="text-sm font-medium text-foreground truncate">
                      #{post.number} {post.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {status && (
                      <Badge variant="outline" className="text-[11px] py-0 h-5">
                        <span
                          className="size-2 rounded-full mr-1.5 shrink-0"
                          style={{ backgroundColor: status.color }}
                        />
                        {status.name}
                      </Badge>
                    )}

                    {isAlreadyLinkedHere && (
                      <Badge variant="neutral" className="text-[10px] py-0 h-5">
                        Already linked
                      </Badge>
                    )}

                    {isLinkedElsewhere && (
                      <Badge variant="danger" className="text-[10px] py-0 h-5">
                        Linked elsewhere
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
