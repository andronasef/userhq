# Changelog

## Unreleased

### Added

- Add purposeful dialog, drawer, menu, press, and public portal section motion with immediate keyboard paths and reduced-motion alternatives.

### Changed

- Apply the UserHQ brand identity across the web app with the supplied logo, local Manrope and Space Grotesk fonts, Calm Teal accents, green-tinted paper surfaces, and a fixed #0F182A face and favicon while preserving tenant branding.

### Fixed

- Apply committed database migrations before native dev startup to prevent OAuth callback failures against an outdated schema.
- Load native development settings from the Git-ignored root `env.local.dev` file for both servers.
- Proxy development API and upload requests to NestJS so social sign-in reaches the backend.
- Preserve shared package builds when starting watchers to avoid API startup import failures.
