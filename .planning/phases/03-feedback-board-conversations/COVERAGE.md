# API Coverage — Brevo SMTP relay (smtp-relay.brevo.com)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> The only external service this phase integrates is Brevo, reached over SMTP (OPS-03, CLAUDE.md Email constraint). Mailpit is a local development container, not an external API.

| capability | decision | reason |
|---|---|---|
| smtp-submission (authenticated send on 587/2525/465) | INTEGRATE | |
| starttls-and-implicit-tls | INTEGRATE | |
| sender-domain-authentication (DKIM/SPF, verified sender) | INTEGRATE | |
| list-unsubscribe-one-click-headers (RFC 8058) | INTEGRATE | |
| transactional-email-rest-api | OPT-OUT | explicitly out of scope — user decision to use SMTP configured only by env so the provider can be swapped |
| bounce-and-complaint-webhooks | OPT-OUT | not needed yet — no bounce-handling requirement in v1 at 300 emails/day; failed sends are retried and logged by the outbox |
| contact-lists-and-marketing-campaigns | OPT-OUT | explicitly out of scope — v1 sends exactly one email type (comment digest) |
| email-templates-hosted-by-brevo | OPT-OUT | not needed — templates are rendered in the API (plain text + escaped HTML) |
| delivery-statistics-api | OPT-OUT | not needed yet — no reporting requirement in v1 |
