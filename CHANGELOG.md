# Changelog

## Unreleased

### Changed

- Apply the UserHQ brand identity across the web app with the supplied logo, local Manrope and Space Grotesk fonts, indigo and paper surfaces, and refreshed welcome and sign-in screens while preserving tenant branding.

### Fixed

- Apply committed database migrations before native dev startup to prevent OAuth callback failures against an outdated schema.
- Load native development settings from the Git-ignored root `env.local.dev` file for both servers.
- Proxy development API and upload requests to NestJS so social sign-in reaches the backend.
- Preserve shared package builds when starting watchers to avoid API startup import failures.
