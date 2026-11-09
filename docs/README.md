# UserHQ documentation

These guides describe the implemented platform and automation contracts on the current branch. The [changelog](../CHANGELOG.md) identifies released behavior and upgrade requirements; a guide committed after a tag may include corrections absent from that tagged revision.

| Reader or task | Start here | Continue with |
| --- | --- | --- |
| Customer submitting feedback | [User guide](user-guide.md) | Board, votes, comments, roadmap, changelog and FAQ sections |
| Workspace owner or admin | [User guide](user-guide.md) | Workspace inbox, product switches, user badges, publication, themes and notifications |
| Developer automating a workspace | [API quickstart](api-quickstart.md) | [Canonical API reference](automation-api.md) for routes, scopes, filters, exports and webhooks |
| LLM or coding assistant using the platform/API | [LLM guide](llm-guide.md) | [Repository LLM index](../llms.txt), API quickstart and reference |
| Operator deploying or upgrading | [Deployment runbook](deploy.md) | [Release notes](../CHANGELOG.md), environment and migration requirements |
| Contributor changing behavior or releasing | [Repository instructions](../AGENTS.md) | [README](../README.md), affected guides and release documentation checklist |

The API reference is the canonical human-readable endpoint catalog. The quickstart and LLM guide link to it rather than defining alternative contracts. Validate version-specific integrations against the source at the deployed revision. Documentation files and `llms.txt` are repository artifacts; this change does not introduce a hosted documentation route or OpenAPI endpoint.

Product ideas and design decisions in [the expansion spec](specs/workspace-platform-expansion.md) explain intent. Use the implemented guides, current controllers and shared schemas when intent and shipped behavior differ.

Before every release tag, update the changelog and review all affected documents. Major changes to workflows, API contracts, authorization, storage, configuration or notification behavior require corresponding documentation in the same change. See [the persistent release policy](../AGENTS.md#documentation-and-release-tags).
