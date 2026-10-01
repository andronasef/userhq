<div align="center">

# UserHQ

**Modern, open-source customer feedback, public roadmap, and changelog platform.**

Turn user requests into actionable roadmaps and shipped updates — without the noise of traditional support tickets.

[![Bun](https://img.shields.io/badge/Bun-1.4+-black?logo=bun)](https://bun.sh)
[![Next.js](https://img.shields.io/badge/Next.js-16.x_(vinext)-black?logo=next.js)](https://github.com/cloudflare/vinext)
[![NestJS](https://img.shields.io/badge/NestJS-12.x-E0234E?logo=nestjs)](https://nestjs.com)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.45+-C5F74F?logo=drizzle)](https://orm.drizzle.team)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql)](https://www.postgresql.org)
[![Better Auth](https://img.shields.io/badge/Better_Auth-1.7+-green)](https://better-auth.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0+-blue?logo=typescript)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Features](#key-features) • [Architecture](#architecture--tech-stack) • [Monorepo Structure](#monorepo-structure) • [Getting Started](#getting-started) • [Self-Hosting](#self-hosting--deployment) • [Roadmap](#roadmap)

</div>

---

## 💡 What is UserHQ?

**UserHQ** gives B2B SaaS teams, indie hackers, agencies, and creators a clean, branded portal where customers can submit suggestions, upvote requested features, track a public roadmap, read product release notes, and browse an FAQ.

Behind the scenes, your product and engineering team manages ideas privately with a dual-layer Kanban board linked directly to the same underlying customer data.

> **Core Value**: Admins see what users actually need ranked by real demand, and close the loop publicly: **Feedback in → Roadmap planned → Changelog shipped**.

---

## ✨ Key Features

### 🗳️ Customer Feedback Board
- **Idea Submission & Upvoting**: Allow users to propose ideas, vote on features, and prevent duplicate requests.
- **Categorization & Filtering**: Filter by categories and sort by *Top Voted* or *Newest*.
- **Admin Moderation & Badges**: Engage directly with users in comment threads with official team badges.
- **Status Badges**: Real-time status tags (*Under Review*, *Planned*, *In Progress*, *Shipped*).

### 🗺️ Dual-Layer Roadmap
- **Internal Kanban Board**: Move items between custom stages while keeping internal discussions, assignees, and deadlines private.
- **Feedback Linking**: Link one or more customer feedback posts to roadmap items. When the roadmap item updates, linked posts update automatically.
- **Public vs. Private View**: Switch any roadmap item to public with a single click.
- **Strict Privacy Guarantee**: Public views are strictly allowlisted at the database and API query layer — private notes, assignees, and internal deadlines never leak to public endpoints.

### 📣 Visual Rich-Text Changelog
- **Rich Editor**: Powered by [Tiptap](https://tiptap.dev) with support for formatted text, links, and inline media.
- **Automated WebP Optimization**: Images uploaded to changelog posts are automatically converted to optimized WebP formats on the server.
- **Categorized Releases**: Tag entries (*New Feature*, *Improvement*, *Fix*) and publish directly to a public feed.

### ❓ Self-Serve FAQ
- Group common questions and answers into categories so users can resolve inquiries without filing duplicate feedback.
- Fast instant search across FAQ entries.

### 🏢 Multi-Product Tenancy
UserHQ provides a clean 3-tier tenancy hierarchy:
```text
User (Global platform account via OAuth)
  └─ Workspace (Company identity, team members, settings)
       └─ Product (Dedicated public portal: Board, Roadmap, Changelog, FAQ)
```
- **Global User Accounts**: End users sign in once with Google or GitHub and can interact with any product portal across workspaces.
- **Multiple Products per Company**: One workspace can manage multiple distinct app portals with independent branding, boards, and roadmaps.

---

## 🏗️ Architecture & Tech Stack

UserHQ is architected as a high-performance monorepo with clean separation between the frontend presentation layer and the hardened API server.

```
                           ┌───────────────────────────────┐
                           │          Traefik /            │
                           │       Reverse Proxy           │
                           └───────┬───────────────┬───────┘
                                   │               │
                    /api/*, /uploads/*          /* (All web routes)
                                   │               │
                                   ▼               ▼
                        ┌──────────────────┐ ┌───────────────────┐
                        │    apps/api      │ │     apps/web      │
                        │    (NestJS 12)   │ │  (Next.js 16 via  │
                        │                  │ │     vinext)       │
                        └────────┬─────────┘ └─────────┬─────────┘
                                 │                     │
                  Better Auth, Drizzle, Sharp          │ RSC fetch /
                                 │                     │ Cookie proxy
                                 ▼                     ▼
                        ┌──────────────────┐ ┌───────────────────┐
                        │   PostgreSQL 18  │ │  packages/types   │
                        │  & Local Storage │ │  (Shared Zod DTOs)│
                        └──────────────────┘ └───────────────────┘
```

| Layer | Technology | Rationale |
|---|---|---|
| **Package Manager** | [Bun](https://bun.sh) | Ultra-fast dependency resolution, native monorepo workspace support, and text-based `bun.lock`. |
| **Frontend Web** | [Next.js 16](https://nextjs.org) + [vinext](https://github.com/cloudflare/vinext) | React Server Components (RSC) and App Router built on Vite for lightning-fast HMR and standalone Node container builds. |
| **Styling & UI** | [Tailwind CSS v4](https://tailwindcss.com) + [Radix UI](https://www.radix-ui.com) | Modern CSS utility engine with accessible headless UI primitives and Lucide icons. |
| **Backend API** | [NestJS 12](https://nestjs.com) | Decoupled, modular enterprise architecture with native Standard Schema (Zod) validation and serialization. |
| **Database & ORM** | [PostgreSQL 18](https://www.postgresql.org) + [Drizzle ORM](https://orm.drizzle.team) | Schema-as-code with type-safe SQL queries, explicit column allowlists, and migrations. |
| **Authentication** | [Better Auth](https://better-auth.com) | Unified OAuth (Google, GitHub) with database-backed sessions managed securely in the API. |
| **Media Processing** | [Sharp](https://sharp.pixelplumbing.com) | High-performance server-side WebP image conversion and EXIF stripping. |

---

## 📁 Monorepo Structure

```text
userhq/
├── apps/
│   ├── api/             # NestJS 12 API server (auth, business logic, uploads)
│   └── web/             # Next.js 16 app built with vinext (RSC, App Router, UI)
├── packages/
│   ├── db/              # Drizzle ORM schema, migrations, and database connection pool
│   └── types/           # Shared Zod contracts, DTOs, and public response models
├── .planning/           # Product specifications, architecture research, and roadmap
├── docker-compose.yml   # Local development services (Postgres, Mailpit)
├── package.json         # Workspace manifest with catalog versions
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- [Bun](https://bun.sh) (`v1.4+`) installed
- [Docker](https://www.docker.com/) & Docker Compose (for local PostgreSQL)
- Node.js `24.x LTS` (runtime for containers)

### 1. Clone the Repository
```bash
git clone https://github.com/andronasef/userhq.git
cd userhq
```

### 2. Install Dependencies
Always use **Bun** to install monorepo dependencies:
```bash
bun install
```

### 3. Start Local Infrastructure
Launch PostgreSQL and Mailpit using Docker Compose:
```bash
docker compose up -d
```

### 4. Configure Environment Variables
Copy example environment files and update your credentials:
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

### 5. Generate and Apply Database Migrations
```bash
bun run --filter @userhq/db db:generate
bun run --filter @userhq/db db:migrate
```

### 6. Run the Development Environment
```bash
bun run dev
```

The web application will be accessible at `http://localhost:3000` and the API at `http://localhost:4000`.

---

## 🛡️ Security & Privacy Guarantees

- **Allowlisted Public Models**: Endpoints serving public feedback and roadmaps explicitly specify allowed database columns. Internal notes, sprint assignments, and target deadlines can never be leaked.
- **Tenant Isolation**: Every database query is strictly scoped by workspace and product IDs, enforced by NestJS guards and tested via automated cross-tenant security suites.
- **Credential Separation**: The frontend web application never receives database credentials. All database interactions remain strictly contained inside the API container.

---

## 🚢 Self-Hosting & Deployment

UserHQ is designed to run affordably on any VPS or self-hosted Docker platform (such as [Dokploy](https://dokploy.com) or Coolify):

- **Zero Vendor Lock-in**: Uses local filesystem volume storage for uploaded media — no mandatory S3 or cloud vendor fees.
- **Two Docker Containers**: One for `apps/web` (standalone Node output) and one for `apps/api`.
- **Persistent Volumes**: Named Docker volumes preserve both PostgreSQL data and uploaded WebP images across updates.

---

## 🗺️ Roadmap

- [x] **Phase 1: Architecture & Walking Skeleton**
  - Bun workspace monorepo foundation
  - NestJS 12 API with Better Auth integration
  - Next.js 16 + vinext standalone setup
  - PostgreSQL 18 & Drizzle ORM schema
- [ ] **Phase 2: Multi-Tenant Workspace & Product Management**
- [ ] **Phase 3: Feedback Board & Upvoting Engine**
- [ ] **Phase 4: Dual-Layer Kanban Roadmap & Status Sync**
- [ ] **Phase 5: Changelog Engine with Tiptap & WebP Uploads**
- [ ] **Phase 6: Self-Serve FAQ & Public Search**

---

## 🤝 Contributing

Contributions, feature suggestions, and bug reports are welcome!
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
