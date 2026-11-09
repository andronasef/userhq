<!-- section: overview -->
## Overview & Structure

UserHQ helps your team collect and act on feedback from your customers. Here is how your workspace is structured:

<cards>
- **1. Workspace**: Your team's central home. Houses your team members, billing, API keys, webhooks, and the unified feedback inbox across all your products.
- **2. Products**: The individual apps or services you build (e.g. Web App, iOS App, API). Each product has its own feedback board, roadmap, changelog, categories, and custom branding.
- **3. Customer Portals**: The branded portal your users visit to submit ideas, upvote feature requests, track your public roadmap, and read release announcements.
</cards>

<!-- section: roles-permissions -->
## Roles & Team Permissions

Collaborate with your entire team while maintaining control over workspace settings:

<cards>
- **Workspace Owner**: Full workspace control: manage subscriptions, invite admins, create API keys, configure webhooks, and transfer ownership.
- **Workspace Admin**: Can manage products, triage feedback, reply officially to customers, manage roadmap cards, and publish release notes.
- **Workspace Member**: Can view feedback submissions, participate in internal team discussions, and track customer feature requests.
</cards>

<!-- section: requests-inbox -->
## Requests (All Boards) & Triage

Located at `/dashboard/[ws]/requests`, the unified Requests inbox brings together all customer submissions from every product into a single high-performance triage view.

<cards>
- **Multi-Dimension Filtering**: Filter instantly by Product, Status Phase (Backlog, In Progress, Completed), Category, Keyword search, and Date ranges.
- **Fast Status Updates**: Move items between stages (Under Review, Planned, In Progress, Completed) with one click. Customers who upvoted the request are notified automatically.
</cards>

<!-- section: comments-attention -->
## Comments & Needs Attention Inbox

Located at `/dashboard/[ws]/comments`, this inbox acts like a responsive customer support desk for your feedback threads.

### Workflow Stages

<stages>
- **Needs Attention**: Any customer comment that has not received an official team response. Highlighted with amber indicators so customer inquiries are never overlooked.
- **Handled**: Automatically cleared from the attention queue as soon as a team member replies with an official badge, or manually marked as handled.
</stages>

<!-- section: author-location -->
## Author Contact & Location Insights

To give your team valuable context on who is submitting feedback, request and comment cards in your dashboard display author details:

- **Direct Email Reach-Out**: Click the mailto button next to the author's name to quickly contact them for user interviews or follow-up questions.
- **Geographic Context**: View the customer's approximate location (e.g. `London, United Kingdom [GB]`) to understand geographic usage trends.
- **Privacy by Design**: Author email addresses and locations are strictly visible to workspace team members and are never displayed on public customer portals.

<!-- section: customer-portals -->
## Public Customer Portals

Every product in your workspace can have its own public portal at `/[ws]/[product]`.

<cards>
- **Modular Feature Toggles**: Independently enable or disable the Feedback Board, Roadmap, Changelog, or FAQ per product based on what you are ready to share.
- **Custom Branding & Colors**: Customize your portal with your logo, brand name, and custom accent color to create a seamless extension of your app.
- **Multi-Language & RTL**: Support 13 languages with automatic visitor detection, language pickers, and localized entry authoring across Roadmap, Changelog, and FAQ.
- **Changing the Default Language**: Existing translations are promoted into the main fields and the previous text is kept as a translation. Review the preview counts first; entries without a translation keep their current text.
- **User Badges**: Recognize customers with badges shown beside their names on posts and comments. Assign them manually or by attribution rules matched from signed or unsigned links, and browse them in the product users directory.
</cards>

<!-- section: roadmap-changelog -->
## Roadmap Planning & Release Notes

<cards>
- **Interactive Roadmap**: Organize feature development into visual columns (e.g. Under Consideration, Planned, In Progress). Link customer feedback directly to roadmap cards so subscribers stay informed as features advance.
- **Changelog & Release Announcements**: Publish release notes tagged with categories (New Feature, Improvement, Bug Fix). Publishing a release note automatically closes the loop with customers who requested linked features.
</cards>

<!-- section: faq-system -->
## Self-Serve FAQ Knowledge Base

Add frequently asked questions organized into categories on your product portal. Giving customers instant answers reduces duplicate feature submissions and common support requests.

<!-- section: themes-push -->
## Themes & Web Push Alerts

UserHQ includes four themes: **System**, **Light**, **Dark** (deep navy), and **Charcoal** (neutral near-black). Team members can also enable browser Web Push notifications in `/account` to receive instant alerts when customers submit new feedback or comments.

<!-- section: api-overview -->
## Automation API & Authentication

Connect external systems, CI/CD pipelines, Slack, Discord, Linear, GitHub, or custom internal dashboards using the UserHQ REST Automation API.

### Authentication Header

```http
Authorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

<cards>
- **Rate Limits**: Generous 120 requests/minute allowance per API key with automatic token-bucket throttling.
- **Scoped Permissions**: Keys can be scoped to specific products and granted read/write permissions for specific resources.
</cards>

<!-- section: swagger-explorer -->
## Interactive API Explorer

Test endpoints, inspect parameters, view request and response schemas, and generate instant code snippets in cURL, TypeScript, and Python.

[component:swagger-explorer]

<!-- section: webhooks-hmac -->
## Webhooks & HMAC Signature Verification

UserHQ delivers real-time HTTP POST events whenever requests are created, status changes occur, or comments arrive. Every delivery includes a secure HMAC-SHA256 signature in the `x-userhq-signature` header.

### Node.js / Express HMAC Verification Example

```typescript
import crypto from "crypto";

export function verifyUserHqWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const expectedHeader = `sha256=${expectedSignature}`;
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expectedHeader)
  );
}
```
