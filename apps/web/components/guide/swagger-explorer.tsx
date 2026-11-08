"use client";

import * as React from "react";
import {
  API_ENDPOINTS,
  API_TAGS,
  type ApiTag,
  type EndpointSpec,
  type HttpMethod,
} from "./api-spec";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Filter,
  KeyRound,
  Lock,
  Search,
  Terminal,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SwaggerExplorerProps {
  workspaces?: Array<{ slug: string; name: string }>;
}

const METHOD_STYLES: Record<
  HttpMethod,
  {
    badge: string;
    border: string;
    bgHover: string;
    cardHeader: string;
  }
> = {
  GET: {
    badge:
      "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    border: "border-blue-500/30",
    bgHover: "hover:bg-blue-500/5",
    cardHeader: "bg-blue-500/5",
  },
  POST: {
    badge:
      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    border: "border-emerald-500/30",
    bgHover: "hover:bg-emerald-500/5",
    cardHeader: "bg-emerald-500/5",
  },
  PUT: {
    badge:
      "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    border: "border-amber-500/30",
    bgHover: "hover:bg-amber-500/5",
    cardHeader: "bg-amber-500/5",
  },
  PATCH: {
    badge:
      "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    border: "border-amber-500/30",
    bgHover: "hover:bg-amber-500/5",
    cardHeader: "bg-amber-500/5",
  },
  DELETE: {
    badge:
      "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
    border: "border-rose-500/30",
    bgHover: "hover:bg-rose-500/5",
    cardHeader: "bg-rose-500/5",
  },
};

export function SwaggerExplorer({ workspaces = [] }: SwaggerExplorerProps) {
  const [selectedTag, setSelectedTag] = React.useState<ApiTag>("All");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [expandedEndpoints, setExpandedEndpoints] = React.useState<
    Record<string, boolean>
  >({
    "list-requests": true, // open the first endpoint by default
  });

  const [activeWsSlug, setActiveWsSlug] = React.useState(
    workspaces[0]?.slug ?? "acme"
  );

  const toggleEndpoint = (id: string) => {
    setExpandedEndpoints((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    API_ENDPOINTS.forEach((ep) => {
      next[ep.id] = true;
    });
    setExpandedEndpoints(next);
  };

  const collapseAll = () => {
    setExpandedEndpoints({});
  };

  const filteredEndpoints = React.useMemo(() => {
    return API_ENDPOINTS.filter((ep) => {
      if (selectedTag !== "All" && ep.tag !== selectedTag) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPath = ep.path.toLowerCase().includes(q);
        const matchesSummary = ep.summary.toLowerCase().includes(q);
        const matchesDesc = ep.description.toLowerCase().includes(q);
        const matchesMethod = ep.method.toLowerCase().includes(q);
        const matchesScope = ep.scope.toLowerCase().includes(q);
        return (
          matchesPath ||
          matchesSummary ||
          matchesDesc ||
          matchesMethod ||
          matchesScope
        );
      }
      return true;
    });
  }, [selectedTag, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Filter and Search Bar */}
      <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search endpoints by path, verb, scope, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-lg placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-border transition-all"
            />
          </div>

          {workspaces.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground whitespace-nowrap font-medium">
                Workspace:
              </span>
              <select
                value={activeWsSlug}
                onChange={(e) => setActiveWsSlug(e.target.value)}
                className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {workspaces.map((w) => (
                  <option key={w.slug} value={w.slug}>
                    {w.name} ({w.slug})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs self-end sm:self-center">
            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors font-medium"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors font-medium"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Tag Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/60">
          <span className="text-xs font-semibold text-muted-foreground mr-1.5 flex items-center gap-1">
            <Filter className="size-3" />
            Category:
          </span>
          {API_TAGS.map((tag) => {
            const isSelected = selectedTag === tag;
            const count =
              tag === "All"
                ? API_ENDPOINTS.length
                : API_ENDPOINTS.filter((e) => e.tag === tag).length;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(tag)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5",
                  isSelected
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{tag}</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full",
                    isSelected
                      ? "bg-background/20 text-background"
                      : "bg-background/80 text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Endpoints Inventory */}
      <div className="space-y-3">
        {filteredEndpoints.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-border bg-card/40 space-y-2">
            <p className="text-sm font-medium text-foreground">
              No endpoints matching &quot;{searchQuery}&quot;
            </p>
            <p className="text-xs text-muted-foreground">
              Try adjusting your search query or switching categories above.
            </p>
          </div>
        ) : (
          filteredEndpoints.map((ep) => (
            <EndpointCard
              key={ep.id}
              endpoint={ep}
              isExpanded={!!expandedEndpoints[ep.id]}
              onToggle={() => toggleEndpoint(ep.id)}
              wsSlug={activeWsSlug}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface EndpointCardProps {
  endpoint: EndpointSpec;
  isExpanded: boolean;
  onToggle: () => void;
  wsSlug: string;
}

function EndpointCard({
  endpoint,
  isExpanded,
  onToggle,
  wsSlug,
}: EndpointCardProps) {
  const styles = METHOD_STYLES[endpoint.method];
  const [activeTab, setActiveTab] = React.useState<"docs" | "snippets" | "try">(
    "docs"
  );
  const [snippetLanguage, setSnippetLanguage] = React.useState<
    "curl" | "typescript" | "python"
  >("curl");
  const [selectedResponseStatus, setSelectedResponseStatus] = React.useState<
    number
  >(endpoint.responses[0]?.status ?? 200);
  const [copied, setCopied] = React.useState(false);

  // Formatted path with current workspace
  const resolvedPath = endpoint.path.replace("{ws}", wsSlug);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCurlSnippet = () => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://app.userhq.com";
    const headers = [
      `-H "Authorization: Bearer <YOUR_API_KEY>"`,
      endpoint.requestBody ? `-H "Content-Type: application/json"` : null,
    ]
      .filter(Boolean)
      .join(" \\\n  ");

    const data = endpoint.requestBody
      ? ` \\\n  -d '${JSON.stringify(endpoint.requestBody.example, null, 2)}'`
      : "";

    return `curl -X ${endpoint.method} "${origin}${resolvedPath}" \\\n  ${headers}${data}`;
  };

  const getTypeScriptSnippet = () => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://app.userhq.com";
    const bodyStr = endpoint.requestBody
      ? `,\n  body: JSON.stringify(${JSON.stringify(
          endpoint.requestBody.example,
          null,
          4
        )})`
      : "";

    return `const response = await fetch("${origin}${resolvedPath}", {
  method: "${endpoint.method}",
  headers: {
    "Authorization": "Bearer <YOUR_API_KEY>"${
      endpoint.requestBody ? ',\n    "Content-Type": "application/json"' : ""
    }
  }${bodyStr}
});

const data = await response.json();
console.log(data);`;
  };

  const getPythonSnippet = () => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://app.userhq.com";
    const bodyStr = endpoint.requestBody
      ? `, json=${JSON.stringify(endpoint.requestBody.example, null, 4)}`
      : "";

    return `import requests

url = "${origin}${resolvedPath}"
headers = {
    "Authorization": "Bearer <YOUR_API_KEY>"${
      endpoint.requestBody ? ',\n    "Content-Type": "application/json"' : ""
    }
}

response = requests.${endpoint.method.toLowerCase()}(url, headers=headers${bodyStr})
data = response.json()
print(data)`;
  };

  return (
    <div
      className={cn(
        "rounded-xl border transition-all duration-200 overflow-hidden bg-card/70 shadow-sm",
        isExpanded
          ? styles.border
          : "border-border hover:border-border/80"
      )}
    >
      {/* Endpoint Accordion Header */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full text-left p-3.5 flex items-center justify-between gap-3 transition-colors",
          styles.bgHover,
          isExpanded && styles.cardHeader
        )}
      >
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <span
            className={cn(
              "px-2.5 py-0.5 rounded-md text-xs font-mono font-bold tracking-wide uppercase border flex-shrink-0",
              styles.badge
            )}
          >
            {endpoint.method}
          </span>

          <span className="font-mono text-xs sm:text-sm font-semibold text-foreground tracking-tight break-all">
            {endpoint.path.split(/(\{.*?\})/).map((part, i) =>
              part.startsWith("{") && part.endsWith("}") ? (
                <span
                  key={i}
                  className="text-[var(--primary-text)] font-bold bg-[var(--primary)]/10 px-1 py-0.5 rounded"
                >
                  {part}
                </span>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </span>

          <span className="hidden sm:inline-block text-xs text-muted-foreground truncate">
            — {endpoint.summary}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full border border-border/80 bg-muted/60 text-muted-foreground"
            title={`Required Scope: ${endpoint.scope}`}
          >
            <Lock className="size-3 text-muted-foreground" />
            <span className="hidden md:inline">{endpoint.scope}</span>
          </span>

          {isExpanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded Details Pane */}
      {isExpanded && (
        <div className="p-4 sm:p-5 border-t border-border space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
            <div>
              <p className="text-sm font-medium text-foreground">
                {endpoint.summary}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {endpoint.description}
              </p>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-lg border border-border self-stretch sm:self-auto justify-center">
              <button
                type="button"
                onClick={() => setActiveTab("docs")}
                className={cn(
                  "px-3 py-1 rounded text-xs font-medium transition-all",
                  activeTab === "docs"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Specification
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("snippets")}
                className={cn(
                  "px-3 py-1 rounded text-xs font-medium transition-all flex items-center gap-1",
                  activeTab === "snippets"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Code2 className="size-3.5" />
                <span>Code Examples</span>
              </button>
            </div>
          </div>

          {activeTab === "docs" && (
            <div className="space-y-6">
              {/* Scope & Authorization Header Requirement */}
              <div className="p-3 rounded-lg border border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <KeyRound className="size-4 text-amber-500" />
                  <span className="font-semibold text-foreground">
                    Required Authorization:
                  </span>
                  <code className="px-1.5 py-0.5 rounded bg-muted font-mono font-bold text-foreground">
                    Bearer &lt;YOUR_API_KEY&gt;
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Scope:</span>
                  <code className="px-1.5 py-0.5 rounded bg-muted text-[var(--primary-text)] font-mono font-semibold">
                    {endpoint.scope}
                  </code>
                  {endpoint.productRestrictedCapable && (
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-medium">
                      Product Restrictable
                    </span>
                  )}
                </div>
              </div>

              {/* Parameters Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Terminal className="size-3.5" />
                  Parameters
                </h4>
                {endpoint.parameters.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No query or path parameters required.
                  </p>
                ) : (
                  <div className="border border-border rounded-lg overflow-x-auto bg-card">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                          <th className="py-2 px-3">Name</th>
                          <th className="py-2 px-3">In</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {endpoint.parameters.map((p) => (
                          <tr key={p.name} className="hover:bg-muted/10">
                            <td className="py-2.5 px-3 font-mono font-medium text-foreground whitespace-nowrap">
                              {p.name}
                              {p.required ? (
                                <span className="ml-1.5 text-rose-500 font-bold">
                                  *
                                </span>
                              ) : (
                                <span className="ml-1.5 text-muted-foreground text-[10px] font-normal">
                                  opt
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground capitalize font-mono text-[11px]">
                              {p.in}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-muted-foreground text-[11px]">
                              {p.type}
                            </td>
                            <td className="py-2.5 px-3 text-foreground/90">
                              <div>{p.description}</div>
                              {p.default && (
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  Default: <code className="px-1 py-0.2 rounded bg-muted">{p.default}</code>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Request Body (if any) */}
              {endpoint.requestBody && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Zap className="size-3.5" />
                      Request Body ({endpoint.requestBody.contentType})
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          JSON.stringify(endpoint.requestBody?.example, null, 2)
                        )
                      }
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                      {copied ? (
                        <Check className="size-3 text-emerald-500" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                      <span>Copy payload</span>
                    </button>
                  </div>
                  <pre className="p-3.5 rounded-lg border border-border bg-muted/40 font-mono text-xs text-foreground overflow-x-auto">
                    {JSON.stringify(endpoint.requestBody.example, null, 2)}
                  </pre>
                </div>
              )}

              {/* Responses Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Responses
                </h4>
                <div className="flex items-center gap-2 flex-wrap">
                  {endpoint.responses.map((resp) => {
                    const isSuccess = resp.status >= 200 && resp.status < 300;
                    const isClientErr = resp.status >= 400 && resp.status < 500;
                    return (
                      <button
                        key={resp.status}
                        type="button"
                        onClick={() => setSelectedResponseStatus(resp.status)}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-all border",
                          selectedResponseStatus === resp.status
                            ? isSuccess
                              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40"
                              : "bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/40"
                            : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {resp.label}
                      </button>
                    );
                  })}
                </div>

                {/* Selected Response Body */}
                {(() => {
                  const currentResponse =
                    endpoint.responses.find(
                      (r) => r.status === selectedResponseStatus
                    ) ?? endpoint.responses[0];
                  if (!currentResponse) return null;

                  return (
                    <div className="rounded-lg border border-border overflow-hidden bg-card">
                      <div className="px-3.5 py-2 border-b border-border bg-muted/30 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {currentResponse.description}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(
                              JSON.stringify(currentResponse.body, null, 2)
                            )
                          }
                          className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                        >
                          {copied ? (
                            <Check className="size-3 text-emerald-500" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                          <span>Copy Response</span>
                        </button>
                      </div>
                      <pre className="p-3.5 font-mono text-xs text-foreground overflow-x-auto bg-muted/10">
                        {JSON.stringify(currentResponse.body, null, 2)}
                      </pre>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {activeTab === "snippets" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-lg border border-border">
                  {(
                    [
                      { key: "curl", label: "cURL" },
                      { key: "typescript", label: "TypeScript (Fetch)" },
                      { key: "python", label: "Python (Requests)" },
                    ] as const
                  ).map((lang) => (
                    <button
                      key={lang.key}
                      type="button"
                      onClick={() => setSnippetLanguage(lang.key)}
                      className={cn(
                        "px-2.5 py-1 rounded text-xs font-medium transition-all",
                        snippetLanguage === lang.key
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const code =
                      snippetLanguage === "curl"
                        ? getCurlSnippet()
                        : snippetLanguage === "typescript"
                        ? getTypeScriptSnippet()
                        : getPythonSnippet();
                    copyToClipboard(code);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-card hover:bg-muted/40 transition-colors"
                >
                  {copied ? (
                    <Check className="size-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  <span>{copied ? "Copied!" : "Copy Code"}</span>
                </button>
              </div>

              <div className="relative rounded-lg border border-border bg-muted/30 overflow-hidden">
                <pre className="p-4 font-mono text-xs text-foreground overflow-x-auto leading-relaxed">
                  {snippetLanguage === "curl" && getCurlSnippet()}
                  {snippetLanguage === "typescript" && getTypeScriptSnippet()}
                  {snippetLanguage === "python" && getPythonSnippet()}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
