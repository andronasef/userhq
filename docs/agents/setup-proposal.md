# Matt skills setup proposal

**DRAFT — intended tracker and shared domain layout approved; review this concrete text before applying it.** No labels or issues have been created.

GSD owns planning state, phase research/UI/plan checks and execution. Matt's skills own domain vocabulary, spec/ticket synthesis, behavior-first implementation and diff review. Neither replaces the other.

## Proposed steering block

The existing `.claude/CLAUDE.md` is the setup skill's preferred target; preserve its managed sections and append/update only the following block after review. Root `AGENTS.md` also exists and remains unchanged.

```markdown
## Agent skills

### Issue tracker

Specs and implementation tickets live in GitHub Issues for andronasef/userhq. See docs/agents/issue-tracker.md.

### Domain docs

Use one root GLOSSARY.md and docs/adr/ for domain decisions. See docs/agents/domain.md.
```

## Proposed docs/agents/issue-tracker.md

Issues and specs live in GitHub Issues for `andronasef/userhq`. Use `gh` to read/create/update them. Read full issue bodies and comments before acting. Write multiline bodies to a temporary file and use `--body-file`. Publish specs and approved implementation tickets with `ready-for-agent`; do not publish draft tickets before concrete review. Use native sub-issues and blocking relationships where available, otherwise explicit parent/blocker references. PRs as a request surface: no. Do not close or modify parent issues during ticket decomposition.

No triage-label setup is proposed here because this capture does not invoke the triage flow. Confirm installed triage skill and label vocabulary before running it.

## Proposed docs/agents/domain.md

Read root `GLOSSARY.md` and relevant `docs/adr/` decisions before exploring or planning. Missing domain documents do not block unrelated work. Use glossary terms consistently; report ADR conflicts rather than silently overriding decisions. The API/web/workspace packages share one product domain vocabulary, so this monorepo uses a single glossary.

## Review and activation

Review the exact steering block and document text, proposed test seams and ticket graph in the expansion spec. After approval, apply setup and publish tracker artifacts; retain GSD enforcement. No agent configuration has been edited by this proposal.
