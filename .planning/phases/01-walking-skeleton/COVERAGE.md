# API Coverage — Phase 1 (Google OAuth, GitHub OAuth, Brevo SMTP)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

| capability | decision | reason |
|---|---|---|
| google: sign-in via OAuth authorization code | INTEGRATE | |
| google: profile name and avatar copied at first sign-in (D-03) | INTEGRATE | |
| google: email and email_verified claim used for implicit linking (D-01) | INTEGRATE | |
| google: ID token validation | INTEGRATE | |
| google: refresh tokens and offline access | OPT-OUT | not needed: no Google API is called after sign-in |
| google: additional or incremental scopes (Drive, Calendar, Contacts) | OPT-OUT | explicitly out of scope: sign-in needs only openid, email, profile |
| google: One Tap / FedCM sign-in | OPT-OUT | not needed: the dedicated /login page is the only entry point (D-02) |
| google: consent screen publishing / verification | OPT-OUT | not needed yet: Testing mode with listed users covers Phase 1; tracked as a launch concern in STATE.md |
| google: provider token revocation on sign-out | OPT-OUT | not needed: sign-out ends the UserHQ session only |
| google: profile re-sync on later sign-ins | OPT-OUT | explicitly out of scope per D-03 (copied once) |
| github: sign-in via OAuth App authorization code | INTEGRATE | |
| github: profile name and avatar copied at first sign-in (D-03) | INTEGRATE | |
| github: verified primary email from /user/emails (user:email scope) | INTEGRATE | |
| github: organization and team membership | OPT-OUT | not needed: no org-based access in v1 |
| github: repository or write scopes | OPT-OUT | explicitly out of scope: privacy, never requested |
| github: GitHub App installation flow | OPT-OUT | not needed: an OAuth App suffices for sign-in |
| github: expiring user tokens and refresh | OPT-OUT | not needed: no GitHub API is called after sign-in |
| github: profile re-sync on later sign-ins | OPT-OUT | explicitly out of scope per D-03 |
| brevo: TCP reachability from the VPS on 587/2525/465 | INTEGRATE | |
| brevo: authenticated SMTP session (STARTTLS or TLS + AUTH via verify) | INTEGRATE | |
| brevo: sending transactional email | OPT-OUT | not needed yet: Phase 3 sends comment notifications through the outbox on the recorded port |
| brevo: transactional REST API v3 | OPT-OUT | explicitly out of scope: plain SMTP keeps the provider swappable (CLAUDE.md) |
| brevo: bounce and complaint webhooks | OPT-OUT | not needed yet: revisit with the Phase 3 outbox |
| brevo: sender domain authentication (SPF/DKIM) | OPT-OUT | not needed yet: required before Phase 3 sends production mail |
| brevo: contacts and marketing lists | OPT-OUT | explicitly out of scope: email is for notifications only |
