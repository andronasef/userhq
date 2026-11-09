# Using UserHQ

This guide covers **v0.3.0** and changes on the current `main` branch. Charcoal, the public-header theme icon and the corrected dual post links are post-release changes listed under [Unreleased](../CHANGELOG.md#unreleased); they become available on a hosted instance when its operator deploys that revision. You do not need to install or build UserHQ to use a hosted instance.

UserHQ connects customer feedback to a team's roadmap, release notes and FAQ. A workspace represents a team or company; each product has its own customer portal and content.

## Choose your path

| You are… | Start here | What you can do |
| --- | --- | --- |
| A customer | [Use a product portal](#for-customers-use-a-product-portal) | Browse enabled public content; sign in to submit feedback, vote and join discussions. |
| A workspace administrator | [Set up your workspace](#for-administrators-set-up-your-workspace) | Manage products and content, triage feedback, invite teammates and configure integrations. |
| A workspace owner | [Manage teammates](#manage-teammates) | Perform administrator work and owner-only operations such as deleting the workspace. |
| An operator self-hosting UserHQ | [Deployment runbook](deploy.md) | Configure the server, OAuth, email, storage and browser-push keys. |
| An integrator or assistant | [API guide](api-quickstart.md) / [LLM guide](llm-guide.md) | Use scoped automation without relying on browser sessions. |

## Sign in and find your workspace

1. Open your team's product portal, or visit `/login` on your UserHQ instance.
2. Choose **Continue with Google** or **Continue with GitHub**. There is no password sign-in form.
3. If you received an invitation, open its link while signed in with the email address named in the invitation.
4. Workspace administrators open **Dashboard** and choose a workspace. Customer sign-in alone does not grant dashboard access.

Workspace creation is invite-only. If `/dashboard/new` says **Workspace creation is invite-only**, use your platform invitation or contact the instance operator. A workspace-team invitation grants access to that workspace; it is not permission to create arbitrary workspaces.

### Understand the addresses

Replace `acme` and `widget` below with your actual workspace and product URL names:

| Address | Purpose |
| --- | --- |
| `/acme/widget` | Product portal; opens its first enabled module. |
| `/acme/widget/roadmap` | Public roadmap, when enabled. |
| `/acme/widget/changelog` | Published release notes, when enabled. |
| `/acme/widget/faq` | Customer FAQ, when enabled. |
| `/dashboard/acme` | Workspace Products, Requests and Comments. |
| `/dashboard/acme/widget/board` | Product's administrator feedback board. |
| `/dashboard/acme/widget/settings` | Product settings and portal features. |
| `/account` | Personal appearance, comment-email and push settings. |

The workspace URL name is permanent. Administrators can change a product's URL in Product settings, but old product links stop working; update links you have shared.

## For customers: use a product portal

### Find an answer or an existing request

Your team chooses which **Feedback**, **Roadmap**, **Changelog** and **FAQ** tabs are available. A missing tab may simply be disabled for that product.

- Search the feedback board before submitting a new idea. Filter or sort the board to find related requests.
- Use the FAQ search for answers and browse its categories.
- Check the roadmap for publicly announced work and the changelog for released changes. A roadmap entry describes planned work; it is not a release note.

### Submit, vote and discuss

1. Sign in, open **Feedback**, and choose **New post**.
2. Give the request a clear title, explain the problem and desired outcome, and choose a category when appropriate.
3. If an existing request already expresses your need, vote for it and add useful context instead of duplicating it. Your vote can be toggled off again.
4. Open a post to read and add comments or replies. Replies are displayed one level below their original comment, including replies to replies.

Use the edit or delete controls offered on content you own. Administrators also have moderation controls. Team replies carry the administrator badge; an automation integration may be identified as an integration rather than a human author.

For your own feedback updates, use the portal's **Activity** tab when signed in and the Feedback board is enabled. Notification delivery depends on your preferences, product availability and your current access.

Badges can appear beside customer names on post details and comments.

## For administrators: set up your workspace

### Create and brand a product

1. Open `/dashboard/<workspace>` and select **Create product** on the **Products** tab.
2. Enter the product name and URL name, and optionally add a logo. Check the resulting portal address before sharing it.
3. Open **Product settings** to change the name, URL, logo, tagline or website.
4. Under branding, choose **Accent color** and **Button text color**, then save. Customer pages use the product branding in both light and dark themes.
5. Configure categories and statuses for the product. Categories organize requests; statuses describe the team's workflow. Status names can be customized, so your team need not use the example names in this guide.

New products start with all four portal features enabled. Use **View portal** to check what customers can currently see.

### Recognize product users with badges

In product Settings, open **User Badges & Attribution**, choose **New badge**, and set its name, colors, icon and priority. Open **Rules** and use **Add Rule** to match a query parameter name and value, exactly or with a regular expression. Regexes match the whole input. An unsigned match does not verify a purchase. Use a rule secret for signed links, generated on your backend.

For a rule matching `pro_id`, this Node backend fragment computes the timestamp and signature (read the secret from protected configuration; do not print it):

```js
import { createHmac } from "node:crypto";
const value = "purchase-reference";
const ts = String(Math.floor(Date.now() / 1000));
const sig = createHmac("sha256", process.env.BADGE_RULE_SECRET)
  .update(`${value}.${ts}`).digest("hex");
const params = new URLSearchParams({ pro_id: value, pro_id_ts: ts, pro_id_sig: sig });
// Append params to your product portal URL on the backend.
```

Signed links are valid for 30 days. Avoid sharing them: possession allows use within that window. The portal removes signature parameters before attribution and matched values after processing. A signed httpOnly cookie preserves guest attribution until sign-in, then is consumed. Rule secrets and matching rules are not exposed publicly.

Open the product **Users** page to search/filter participants and inspect activity and assigned badges. Choose **Manage Badges**, then **Grant Badge** (optionally with an expiration date), or **Revoke badge**. Manual grants require an existing workspace member or participant of that product. Badges are product-specific. Inbox/requests badge filters are not yet available.

### Manage teammates

Open the workspace's **Team** page (`/dashboard/<workspace>/team`). The team consists of an owner and workspace administrators; ordinary customer accounts are not team members.

Under **Invite a teammate**, enter their email and create an invite link. Copy and share that link: it works once, is bound to the specified email, and expires at the displayed time. You can revoke an unused invite from the invite list.

Administrators can manage workspace products and content. Ownership does not follow an API key, a customer account, or an invitation to a different workspace. Owner-only controls remain restricted; for example, only the owner can delete a workspace. Deleting a workspace also makes its products unavailable.

## Triage all products from one dashboard

The workspace dashboard has three tabs:

- **Requests (All Boards)**: review feedback from across the workspace's products (the primary landing view).
- **Comments**: work through customer discussions that need a team response.
- **Products**: manage each product, open its portal and choose which products you personally follow.

### Review requests

1. The dashboard opens directly on **Requests (All Boards)**, or select it from the tab bar.
2. Search across requests, or filter by product and status type. The category filter becomes available after selecting a product.
3. Use the created-date range when you need a reporting period; those date filters are labeled UTC.
4. Choose **Top (votes)**, **Newest** or **Recent activity**. Open the relevant request to read its discussion and take product-specific actions.
5. Select **Load more requests** for additional results. Keyset pagination fetches 20 requests per page; filters stay in the URL so you can copy the current view for a teammate.

Each request and comment offers **Dashboard** to open the administrator post page and **Public portal** to open the customer-facing post in a new tab. The public action is unavailable when that product's Feedback board is disabled. Older dashboard `/posts` links redirect to the corresponding `/board` page.

### Author contact and geographic location

Requests and comments in the workspace dashboard display the author's verified contact email (with a quick 1-click mailto action) and their approximate geographic location badge (e.g. `London, United Kingdom [GB]`). This provides private customer context for workspace administrators to follow up directly, verify customer details, and spot regional feedback patterns. Author emails and locations are strictly private to workspace administrators and are never exposed on public customer portals.

The shared dashboard summarizes demand; a request's product and configured status are still the source of context. Lists can change as customers vote or comment, so loading more is not a frozen reporting snapshot.

### Work through comments

Start on **Needs attention**, or switch to **Handled** or **All**. You can also filter comments by product and load more results.

| Action or state | Meaning |
| --- | --- |
| **Needs attention** | A customer comment has not yet been handled by the team. |
| **Reply** → **Send Reply** | Posts an administrator reply and handles the currently unhandled customer comments in that thread. |
| **Mark handled** | Resolves that comment for the team without posting a reply. |
| **Reopen** | Returns a handled customer comment to Needs attention. |
| **Mark as read** | Clears your own unread indicator; it does not resolve the team's attention queue. |

**Handled state is shared; read state is personal.** A teammate's handling action affects the team queue. Your read action does not mark the comment read for everybody else.

An administrator reply from the inbox or the post discussion resolves the thread's outstanding customer comments. A later customer follow-up is a new unhandled comment, so the conversation needs attention again. Earlier handled comments keep their handling history. Administrator comments themselves are not outstanding customer attention items.

## Plan work privately and share the public roadmap

Open the product's administrator **Roadmap** page. Create a roadmap item or edit an existing card, then move cards between the product's configured statuses as work progresses.

The item editor separates two audiences:

| Field | Audience |
| --- | --- |
| **Public title**, **Public description** | Customers, once the item and its status are public. |
| **Internal title**, **Internal description**, **Internal notes** | Workspace administrators only. |
| Assignee and target deadline | Internal planning; not customer-facing promises. |

To publish an item:

1. Write the internal working title and planning details.
2. Enable **Make public**, then review the public title and description. Do not put private planning information into these public fields.
3. Select a status configured to appear on the public roadmap. An item must be public **and** belong to a public-roadmap status to appear to customers.
4. Ensure the product's **Roadmap** portal feature is enabled.

Use **Linked feedback posts** to connect customer requests to the roadmap item. Linked posts take the roadmap item's status when linked or when its status changes, closing the loop with the people who requested the work. A post can be linked to only one roadmap item at a time.

Public roadmap responses do not expose internal titles, descriptions, notes, assignees or deadlines. Keep confidential data in those internal fields rather than relying on a customer not opening a card.

## Publish release notes and FAQ answers

### Changelog

1. Open the product's administrator **Changelog** and create a release note.
2. Write the title and content, add tags as useful, and insert uploaded images through the editor.
3. Use **Save draft** while preparing the entry. Review the save status before leaving.
4. Set **Release date** and choose **Publish**. A future release date schedules visibility; it does not make the entry public immediately.
5. Use **Update** for an already published entry, or **Unpublish** to return it to a non-public state.

Customers can see an entry only when its publication date has arrived and the Changelog feature is enabled. Scheduled webhook announcements are processed in the background; they are not a guarantee of an immediate browser notification. See the [API reference](automation-api.md#events) for announcement timing and disabled-feature behavior.

### FAQ

Open the product's administrator **FAQ**. Create categories, add questions and answers, and drag items to arrange them. Saved answers are available on the public FAQ when that feature is enabled; there is no separate publish step. Customers can search the knowledge base; there is no separate support-ticket workflow implied by an FAQ question.

## Choose which portal features customers see

In **Product settings** → **Portal features**, switch **Feedback board**, **Roadmap**, **Changelog** or **FAQ** on or off and save. Turning features off requires confirmation; turning everything off warns that customers will see an unavailable page.

- Disabling a feature hides its customer navigation and blocks its public content routes, including old direct links.
- Existing content is kept. Administrators can still manage it and enable the feature again.
- With Feedback disabled, the product root opens the first enabled feature in this order: Roadmap, Changelog, FAQ. If none is enabled, the portal is unavailable.
- Turning off Feedback also stops customer feedback notifications. Suppressed activity is not replayed when it is enabled again. Delivery checks current preferences and access before sending; already delivered messages cannot be withdrawn.
- Hiding Roadmap or Changelog also removes their feature-specific public exposure; for example, a hidden roadmap is not shown through a linked-post roadmap banner.

Feature switches are publication controls, not deletion or file-access revocation. A previously shared uploaded-image URL may remain accessible directly. Do not use feature hiding as a way to retract an uploaded secret.

## Personal appearance and notifications

### Light, dark, charcoal or system appearance

Open **Account** (`/account`) → **Appearance**, or the theme menu where available. Choose **Light**, **Dark**, **Charcoal** or **System**. System follows your device's color preference. Dark provides a rich deep-navy palette, while Charcoal provides a neutral near-black palette. This is your device's preference, not a workspace setting that changes everybody's theme.

On a customer portal, use the theme icon in the header beside the sign-in/account controls, or the selector in the footer. The icon menu is available without signing in, also works on mobile, and shares the same saved preference with the footer and dashboard.

### Browser push

1. Open **Account** → **Browser push notifications** in a browser that supports notifications, service workers and Web Push.
2. Choose **Enable push** and allow notifications in the browser's permission prompt. Registration applies to this browser/device; enable it separately on another device if needed.
3. Review **Event triggers**: replies, status updates, new posts in followed products and new comments in followed products.
4. Decide whether to enable **Include message preview in notifications**. It is off by default, so shared screens show generic notification text.
5. Choose **Send test** and check the device's notification center. A successful enqueue message means the test is queued, not proof the operating system displayed it.

Workspace administrators can use **Follow** on a product in the workspace's **Products** tab to receive product-wide new-post and top-level new-comment alerts. **Following** is personal; it neither enables browser permission nor registers a device. These alerts also require your event preference and continuing administrator access.

Use **Unfollow** in Account's **Followed products** list or the Products-tab toggle to stop those product-wide alerts. Reply and status-update preferences are separate. Use **Disable** to unregister this browser's push subscription. Comment-email preferences are a separate Account section.

If notifications were blocked, change this site's notification permission in your browser settings, then return and enable push. Switching accounts in a shared browser requires registering push for the new account; the server accepts a handover only from the browser holding the existing subscription keys and removes the old account's queued deliveries. It does not make a previously displayed notification disappear.

Clicking a feedback notification opens its post. Access and feature settings still apply when the page opens, so a deleted or now-hidden post may no longer be available.

## Connect an integration

Workspace **Settings** contains **API keys** and **Webhooks**. An owner or administrator creates a key for a specific integration and chooses the minimum scopes and product restrictions it needs. Copy the full token when created; it is not shown again. Revoke keys you no longer use.

Webhook signing secrets are shown only when creating or rotating the secret. Save the new value in your receiver before using it; normal list and detail screens cannot reveal it later. Receiver URLs must use public HTTPS.

Start with the [API guide](api-quickstart.md) for authentication and examples, then use the [automation API reference](automation-api.md) for routes, scopes, restrictions, exports and webhook verification. Browser push preferences and team/account administration are not general API-key capabilities.

## In-App Guide and Interactive API Explorer

Workspace owners and administrators can access the interactive in-app guide at `/guide` (accessible from the user dropdown and sidebar navigation). The guide includes Rubix-style documentation covering workspace structure, roles and permissions, triage workflows, portal branding, and an embedded OpenAPI 3.1 Swagger Explorer for testing endpoints and copying code snippets.

## Example: close the feedback loop

1. A customer searches the board and votes for an existing request, adding context in a comment.
2. An administrator finds it under **Requests (All Boards)**, then answers the comment from **Comments**.
3. The team creates a private roadmap item and links the request.
4. When ready to share, the team writes safe public details, makes the item public and selects a public-roadmap status.
5. Moving the item updates the linked request's status. The team publishes a changelog entry when the change ships.
6. If the same question will recur, the team adds a searchable FAQ answer and links customers to it.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| **Couldn't start sign-in** | Retry once and check your connection. If other users are affected, report it to the instance operator: the API or deployment may be unavailable. Operators should use the [deployment runbook](deploy.md), including required persistent VAPID keys; customers do not configure these keys. |
| Invite cannot be accepted | Sign in with the invite's exact email, and ask the sender whether the link expired, was used or was revoked. |
| Workspace creation is invite-only | A customer account or team membership alone does not grant platform workspace-creation permission. Contact the instance operator. |
| A portal tab or old link is unavailable | Ask an administrator whether that feature was disabled, the product URL changed, or the content was removed. |
| Comments remain in Needs attention after reading | Read state is personal. Reply or mark the comment handled to resolve team attention. |
| No push notification | Check site permission, registration on this device, event preferences, product Follow, product availability and OS notification settings. Use Send test. |
| A follow or save change reverses after an error | The request did not persist. Retry after connectivity recovers and confirm the saved state before continuing. |
| API key cannot access a workspace-wide list | Product-restricted keys only reach permitted product-scoped routes. Consult the [API restriction rules](automation-api.md#3-product-restrictions). |
