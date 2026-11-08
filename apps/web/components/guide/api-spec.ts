export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface ParameterDef {
  name: string;
  in: "path" | "query" | "header";
  type: string;
  required: boolean;
  description: string;
  default?: string;
  example?: string;
}

export interface ResponseExample {
  status: number;
  label: string;
  description: string;
  body: Record<string, unknown> | Array<unknown>;
}

export interface EndpointSpec {
  id: string;
  method: HttpMethod;
  path: string;
  tag: string;
  summary: string;
  description: string;
  scope: string;
  productRestrictedCapable: boolean;
  parameters: ParameterDef[];
  requestBody?: {
    contentType: string;
    schema: Record<string, unknown>;
    example: Record<string, unknown>;
  };
  responses: ResponseExample[];
}

export const API_TAGS = [
  "All",
  "Feedback Requests",
  "Comments & Attention",
  "Roadmap",
  "Changelog",
  "FAQ",
  "Webhooks",
  "Export",
] as const;

export type ApiTag = (typeof API_TAGS)[number];

export const API_ENDPOINTS: EndpointSpec[] = [
  {
    id: "list-requests",
    method: "GET",
    path: "/api/v1/workspaces/{ws}/requests",
    tag: "Feedback Requests",
    summary: "Workspace-wide requests inbox",
    description:
      "Query feedback requests across all products in the workspace with keyset pagination, date ranges, and status filtering.",
    scope: "requests:read",
    productRestrictedCapable: false,
    parameters: [
      {
        name: "ws",
        in: "path",
        type: "string",
        required: true,
        description: "Workspace URL slug (e.g. 'acme').",
        example: "acme",
      },
      {
        name: "product",
        in: "query",
        type: "string",
        required: false,
        description: "Filter requests by product slug.",
        example: "mobile-app",
      },
      {
        name: "sort",
        in: "query",
        type: "string (top | new | activity)",
        required: false,
        default: "top",
        description: "Ordering criteria for the inbox.",
      },
      {
        name: "statusType",
        in: "query",
        type: "string (all | backlog | in_progress | completed | canceled)",
        required: false,
        default: "all",
        description: "Filter by status workflow phase.",
      },
      {
        name: "search",
        in: "query",
        type: "string",
        required: false,
        description: "Keyword text search against request title and description.",
      },
      {
        name: "createdFrom",
        in: "query",
        type: "string (YYYY-MM-DD)",
        required: false,
        description: "Start of UTC date range filter.",
        example: "2026-01-01",
      },
      {
        name: "createdTo",
        in: "query",
        type: "string (YYYY-MM-DD)",
        required: false,
        description: "End of UTC date range filter.",
        example: "2026-12-31",
      },
      {
        name: "limit",
        in: "query",
        type: "integer (1..50)",
        required: false,
        default: "20",
        description: "Number of requests to return per page.",
      },
      {
        name: "cursor",
        in: "query",
        type: "string",
        required: false,
        description: "Opaque cursor received from previous page response.",
      },
    ],
    responses: [
      {
        status: 200,
        label: "200 OK",
        description: "List of requests with total count and next cursor.",
        body: {
          items: [
            {
              id: "550e8400-e29b-41d4-a716-446655440000",
              number: 42,
              slug: "export-feedback-as-csv",
              title: "Export feedback as CSV",
              description: "Allow workspace admins to export feedback requests with votes.",
              voteCount: 19,
              createdAt: "2026-11-08T20:15:00.000Z",
              author: {
                name: "Sarah Miller",
                image: "https://example.com/avatar.jpg",
                email: "sarah@example.com",
                location: {
                  country: "United States",
                  countryCode: "US",
                  city: "San Francisco",
                },
                isAdmin: false,
              },
              product: {
                id: "prod-1",
                slug: "mobile-app",
                name: "Mobile App",
                logoUrl: null,
                accentColor: "#6366f1",
              },
              status: {
                id: "stat-1",
                name: "Planned",
                color: "#10b981",
                type: "backlog",
              },
              category: {
                id: "cat-1",
                name: "Reporting",
              },
              commentCount: 6,
            },
          ],
          totalCount: 1,
          nextCursor: null,
        },
      },
      {
        status: 401,
        label: "401 Unauthorized",
        description: "Missing or invalid API key.",
        body: {
          code: "api_key_invalid",
          message: "The provided API key is invalid or not found.",
        },
      },
      {
        status: 403,
        label: "403 Forbidden",
        description: "API key lacks required scope.",
        body: {
          code: "insufficient_scope",
          message: "API key lacks the required 'requests:read' scope.",
        },
      },
    ],
  },
  {
    id: "create-post",
    method: "POST",
    path: "/api/v1/workspaces/{ws}/products/{product}/posts",
    tag: "Feedback Requests",
    summary: "Create a feedback post",
    description:
      "Submit a new request to a specific product feedback board as the integration actor.",
    scope: "requests:write",
    productRestrictedCapable: true,
    parameters: [
      {
        name: "ws",
        in: "path",
        type: "string",
        required: true,
        description: "Workspace URL slug.",
        example: "acme",
      },
      {
        name: "product",
        in: "path",
        type: "string",
        required: true,
        description: "Product URL slug.",
        example: "mobile-app",
      },
    ],
    requestBody: {
      contentType: "application/json",
      schema: {
        title: "string (3..120 chars)",
        description: "string (3..5000 chars)",
        categoryId: "uuid (optional)",
      },
      example: {
        title: "Dark mode support for tablet devices",
        description:
          "Provide full charcoal/dark theme adaptation for iPad and Android tablets.",
        categoryId: "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
      },
    },
    responses: [
      {
        status: 201,
        label: "201 Created",
        description: "Post created successfully.",
        body: {
          id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          number: 88,
          slug: "dark-mode-support-for-tablet-devices",
          title: "Dark mode support for tablet devices",
          description:
            "Provide full charcoal/dark theme adaptation for iPad and Android tablets.",
          status: {
            id: "stat-open",
            name: "Open",
            color: "#6b7280",
            type: "backlog",
          },
          voteCount: 1,
          createdAt: "2026-11-09T01:00:00.000Z",
        },
      },
      {
        status: 400,
        label: "400 Bad Request",
        description: "Validation error in title or description.",
        body: {
          code: "validation_failed",
          message: "Title must be between 3 and 120 characters.",
        },
      },
    ],
  },
  {
    id: "update-post-status",
    method: "PUT",
    path: "/api/v1/workspaces/{ws}/products/{product}/posts/{number}/status",
    tag: "Feedback Requests",
    summary: "Change request status",
    description:
      "Transition a feedback post to a new workflow status with optimistic concurrency protection.",
    scope: "requests:write",
    productRestrictedCapable: true,
    parameters: [
      {
        name: "ws",
        in: "path",
        type: "string",
        required: true,
        description: "Workspace URL slug.",
        example: "acme",
      },
      {
        name: "product",
        in: "path",
        type: "string",
        required: true,
        description: "Product URL slug.",
        example: "mobile-app",
      },
      {
        name: "number",
        in: "path",
        type: "integer",
        required: true,
        description: "Unique post number within the product.",
        example: "42",
      },
    ],
    requestBody: {
      contentType: "application/json",
      schema: {
        statusId: "uuid",
        version: "integer",
        note: "string (optional status change notification note)",
      },
      example: {
        statusId: "e9b2c3d4-e5f6-7890-1234-56789abcdef1",
        version: 3,
        note: "Accepted for Q1 development roadmap.",
      },
    },
    responses: [
      {
        status: 200,
        label: "200 OK",
        description: "Status successfully updated.",
        body: {
          id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          number: 42,
          version: 4,
          statusId: "e9b2c3d4-e5f6-7890-1234-56789abcdef1",
          statusName: "In Progress",
        },
      },
      {
        status: 409,
        label: "409 Conflict",
        description: "Optimistic concurrency conflict (version changed).",
        body: {
          code: "edit_conflict",
          message: "The post was updated by another administrator. Please refresh.",
        },
      },
    ],
  },
  {
    id: "list-comments",
    method: "GET",
    path: "/api/v1/workspaces/{ws}/comments",
    tag: "Comments & Attention",
    summary: "Workspace comments triage inbox",
    description:
      "Triage customer comments across all products, filter by 'needs_attention' or 'handled' status.",
    scope: "comments:read",
    productRestrictedCapable: false,
    parameters: [
      {
        name: "ws",
        in: "path",
        type: "string",
        required: true,
        description: "Workspace URL slug.",
        example: "acme",
      },
      {
        name: "attention",
        in: "query",
        type: "string (needs_attention | handled | all)",
        required: false,
        default: "needs_attention",
        description: "Filter comments by triage state.",
      },
      {
        name: "product",
        in: "query",
        type: "string",
        required: false,
        description: "Product slug filter.",
      },
      {
        name: "limit",
        in: "query",
        type: "integer (1..50)",
        required: false,
        default: "20",
        description: "Results per page.",
      },
    ],
    responses: [
      {
        status: 200,
        label: "200 OK",
        description: "List of comments with needsAttentionCount.",
        body: {
          items: [
            {
              id: "comm-1234-5678",
              body: "Could this also include the customer's billing cycle in the export?",
              createdAt: "2026-11-09T00:30:00.000Z",
              author: {
                name: "Alex Johnson",
                email: "alex@company.org",
                location: {
                  country: "Germany",
                  countryCode: "DE",
                  city: "Berlin",
                },
                isAdmin: false,
              },
              post: {
                id: "post-1",
                number: 42,
                title: "Export feedback as CSV",
                productSlug: "mobile-app",
                productName: "Mobile App",
              },
              handledAt: null,
              handledBy: null,
            },
          ],
          needsAttentionCount: 4,
          nextCursor: null,
        },
      },
    ],
  },
  {
    id: "reply-comment",
    method: "POST",
    path: "/api/v1/workspaces/{ws}/comments/{id}/reply",
    tag: "Comments & Attention",
    summary: "Reply to customer comment",
    description:
      "Send a team or automated integration reply directly to a comment and mark it handled.",
    scope: "comments:write",
    productRestrictedCapable: false,
    parameters: [
      {
        name: "ws",
        in: "path",
        type: "string",
        required: true,
        description: "Workspace URL slug.",
        example: "acme",
      },
      {
        name: "id",
        in: "path",
        type: "uuid",
        required: true,
        description: "UUID of the customer comment being replied to.",
        example: "comm-1234-5678",
      },
    ],
    requestBody: {
      contentType: "application/json",
      schema: {
        body: "string (1..5000 chars)",
      },
      example: {
        body: "Thank you for the suggestion! We've added billing cycle columns to our CSV spec.",
      },
    },
    responses: [
      {
        status: 201,
        label: "201 Created",
        description: "Reply successfully created and parent handled.",
        body: {
          id: "reply-9999-0000",
          body: "Thank you for the suggestion! We've added billing cycle columns to our CSV spec.",
          isAdmin: true,
          createdAt: "2026-11-09T01:10:00.000Z",
          parentHandled: true,
        },
      },
    ],
  },
  {
    id: "mark-handled",
    method: "POST",
    path: "/api/v1/workspaces/{ws}/comments/{id}/handled",
    tag: "Comments & Attention",
    summary: "Mark comment handled",
    description: "Mark an open customer comment as handled so it leaves the needs_attention triage queue.",
    scope: "comments:write",
    productRestrictedCapable: false,
    parameters: [
      {
        name: "ws",
        in: "path",
        type: "string",
        required: true,
        description: "Workspace URL slug.",
      },
      {
        name: "id",
        in: "path",
        type: "uuid",
        required: true,
        description: "Comment UUID.",
      },
    ],
    responses: [
      {
        status: 200,
        label: "200 OK",
        description: "Comment marked handled.",
        body: {
          success: true,
          handledAt: "2026-11-09T01:12:00.000Z",
        },
      },
    ],
  },
  {
    id: "list-roadmap",
    method: "GET",
    path: "/api/v1/workspaces/{ws}/products/{product}/roadmap",
    tag: "Roadmap",
    summary: "List product roadmap",
    description: "Fetch planned, in-progress, and completed roadmap cards with private/public visibility.",
    scope: "roadmap:read",
    productRestrictedCapable: true,
    parameters: [
      {
        name: "ws",
        in: "path",
        type: "string",
        required: true,
        description: "Workspace URL slug.",
      },
      {
        name: "product",
        in: "path",
        type: "string",
        required: true,
        description: "Product URL slug.",
      },
    ],
    responses: [
      {
        status: 200,
        label: "200 OK",
        description: "Array of roadmap items ordered by column and rank.",
        body: {
          items: [
            {
              id: "road-item-1",
              statusId: "stat-in-progress",
              internalTitle: "Implement CSV Export Pipeline",
              publicTitle: "CSV Export Support",
              isPublic: true,
              rank: 1000,
              linkedPostCount: 3,
            },
          ],
        },
      },
    ],
  },
  {
    id: "create-roadmap-item",
    method: "POST",
    path: "/api/v1/workspaces/{ws}/products/{product}/roadmap",
    tag: "Roadmap",
    summary: "Create roadmap item",
    description: "Add a new card to a status column on the product roadmap.",
    scope: "roadmap:write",
    productRestrictedCapable: true,
    parameters: [
      {
        name: "ws",
        in: "path",
        type: "string",
        required: true,
        description: "Workspace URL slug.",
      },
      {
        name: "product",
        in: "path",
        type: "string",
        required: true,
        description: "Product URL slug.",
      },
    ],
    requestBody: {
      contentType: "application/json",
      schema: {
        statusId: "uuid",
        internalTitle: "string",
        internalDescription: "string (optional)",
        publicTitle: "string (optional)",
        publicDescription: "string (optional)",
        isPublic: "boolean",
      },
      example: {
        statusId: "stat-planned",
        internalTitle: "OAuth Google & GitHub enhancements",
        publicTitle: "Social Sign-in Improvements",
        isPublic: true,
      },
    },
    responses: [
      {
        status: 201,
        label: "201 Created",
        description: "Roadmap card created.",
        body: {
          id: "road-new-card",
          internalTitle: "OAuth Google & GitHub enhancements",
          isPublic: true,
        },
      },
    ],
  },
  {
    id: "list-changelog",
    method: "GET",
    path: "/api/v1/workspaces/{ws}/products/{product}/changelog",
    tag: "Changelog",
    summary: "List changelog releases",
    description: "Fetch published and draft release notes along with changelog tags.",
    scope: "changelog:read",
    productRestrictedCapable: true,
    parameters: [
      {
        name: "ws",
        in: "path",
        type: "string",
        required: true,
        description: "Workspace URL slug.",
      },
      {
        name: "product",
        in: "path",
        type: "string",
        required: true,
        description: "Product URL slug.",
      },
    ],
    responses: [
      {
        status: 200,
        label: "200 OK",
        description: "List of entries and available tags.",
        body: {
          entries: [
            {
              id: "cl-entry-1",
              title: "Version 2.4: Instant Feedback Triage",
              body: "## What's New\n- High-speed keyset pagination\n- Attention-based comment sorting",
              isPublished: true,
              publishedAt: "2026-11-01T12:00:00.000Z",
              tags: [{ id: "tag-1", name: "Improvements", color: "#10b981" }],
            },
          ],
          tags: [{ id: "tag-1", name: "Improvements", color: "#10b981" }],
        },
      },
    ],
  },
  {
    id: "list-faq",
    method: "GET",
    path: "/api/v1/workspaces/{ws}/products/{product}/faq",
    tag: "FAQ",
    summary: "Get FAQ knowledge tree",
    description: "Retrieve all self-serve FAQ categories with their published questions and answers.",
    scope: "faq:read",
    productRestrictedCapable: true,
    parameters: [
      {
        name: "ws",
        in: "path",
        type: "string",
        required: true,
        description: "Workspace URL slug.",
      },
      {
        name: "product",
        in: "path",
        type: "string",
        required: true,
        description: "Product URL slug.",
      },
    ],
    responses: [
      {
        status: 200,
        label: "200 OK",
        description: "FAQ categories with nested questions.",
        body: {
          categories: [
            {
              id: "faq-cat-1",
              name: "General Questions",
              rank: 1000,
              questions: [
                {
                  id: "faq-q-1",
                  question: "How do I upvote an existing feedback post?",
                  answer: "Sign in with Google or GitHub and tap the upvote arrow next to any idea.",
                  rank: 1000,
                },
              ],
            },
          ],
        },
      },
    ],
  },
  {
    id: "list-webhooks",
    method: "GET",
    path: "/api/v1/workspaces/{ws}/webhooks",
    tag: "Webhooks",
    summary: "List webhook subscriptions",
    description: "Retrieve configured webhook endpoints and subscribed events.",
    scope: "webhooks:read",
    productRestrictedCapable: false,
    parameters: [
      {
        name: "ws",
        in: "path",
        type: "string",
        required: true,
        description: "Workspace URL slug.",
      },
    ],
    responses: [
      {
        status: 200,
        label: "200 OK",
        description: "Array of webhook endpoints.",
        body: {
          subscriptions: [
            {
              id: "wh-1",
              url: "https://api.yourcompany.com/webhooks/userhq",
              events: ["post.created", "comment.created", "status.changed"],
              isActive: true,
              productRestrictions: null,
            },
          ],
        },
      },
    ],
  },
  {
    id: "export-feedback",
    method: "GET",
    path: "/api/v1/workspaces/{ws}/export/feedback",
    tag: "Export",
    summary: "Bulk export feedback & comments",
    description:
      "Export workspace feedback posts, voter counts, comments, and discussions for backup, BI data warehouses, or CRM sync.",
    scope: "export:read",
    productRestrictedCapable: false,
    parameters: [
      {
        name: "ws",
        in: "path",
        type: "string",
        required: true,
        description: "Workspace URL slug.",
      },
      {
        name: "since",
        in: "query",
        type: "string (ISO 8601)",
        required: false,
        description: "Only export content modified or created after this timestamp.",
        example: "2026-11-01T00:00:00.000Z",
      },
      {
        name: "productId",
        in: "query",
        type: "uuid",
        required: false,
        description: "Restrict export to a single product UUID.",
      },
      {
        name: "limit",
        in: "query",
        type: "integer (1..500)",
        required: false,
        default: "100",
        description: "Batch size per export page.",
      },
    ],
    responses: [
      {
        status: 200,
        label: "200 OK",
        description: "Batch of exported posts with embedded comments.",
        body: {
          items: [
            {
              id: "post-uuid-1",
              number: 42,
              title: "Export feedback as CSV",
              description: "Full post description...",
              voteCount: 19,
              comments: [
                {
                  id: "comm-1",
                  body: "Great idea!",
                  createdAt: "2026-11-08T21:00:00.000Z",
                },
              ],
            },
          ],
          hasMore: false,
          totalCount: 1,
          nextCursor: null,
        },
      },
    ],
  },
];
