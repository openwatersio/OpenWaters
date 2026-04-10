# Business & Operations

## License

This project is licensed under the **GPL v3** with a CLA for contributors to enable Apple App Store distribution.

### Why GPL v3

- **Copyleft protection.** Modifications to Open Waters must be shared back. No one can fork the app, close the source, and compete with a proprietary version.
- **Aligned with the marine open source ecosystem.** OpenCPN uses GPLv2. Choosing GPL v3 keeps Open Waters in the same family.
- **Chart data is not affected.** GPL applies to source code, not content. Chart data, weather data, tide predictions — none of this is subject to the GPL.
- **Dependency compatibility.** All current dependencies (React Native, Expo, MapLibre, Zustand) use MIT or BSD licenses, which are forward-compatible with GPL v3.

### App Store Distribution

The FSF's position is that GPL v3 is incompatible with Apple's App Store terms. The mitigation is a **CLA (Contributor License Agreement)** that grants Open Water Software, LLC the rights needed to distribute through the App Store. Contributors retain full copyright ownership of their work. This is the same approach used by Signal (AGPL v3) and WordPress (GPLv2).

Under GPL v3, plugins that run in-process and use Open Waters's internal APIs are generally considered derivative works and must be GPL-compatible. This is the same model OpenCPN uses.

## Sustainability

Open Waters needs a path to financial sustainability. The goal isn't profit — it's covering hosting costs, chart data licensing, and eventually enabling dedicated development time.

### Revenue Tiers

#### Tier 1: Community Support (from launch)

- **GitHub Sponsors / Patreon** — Recurring donations from users who value the project.
- **One-time donations** — For users who want to support the project without a subscription.

#### Tier 2: Paid App (from v0.1)

- **Paid download on App Store** — A one-time purchase price (e.g., $9.99) rather than a subscription.
  - Sailors are skeptical of subscriptions (burned by Navionics switching from one-time to subscription, which generated widespread resentment).
  - A one-time price signals confidence in the product and respect for the user.
  - The source code remains free and open under GPL v3 — the paid download covers the convenience of the App Store build, signing, and distribution.

#### Tier 3: Add-on Store (future)

- **Chart Store** — Revenue share from chart data subscriptions. Hydrographic offices and third-party providers sell chart data through Open Waters's in-app marketplace.
- **Paid plugins/extensions** — Third-party developers can sell premium plugins through an extension marketplace.
- **Premium data services** — Enhanced weather data, high-resolution bathymetry, or real-time AIS feeds available as paid subscriptions.

### What's Free, What's Paid

| Feature                        | Free (source) | Paid (App Store) | Add-on Store |
| ------------------------------ | ------------- | ---------------- | ------------ |
| Core charting & navigation     | Yes           | Yes              | —            |
| NOAA charts (US)               | Yes           | Yes              | —            |
| GPS, waypoints, routes, tracks | Yes           | Yes              | —            |
| Tides & weather                | Yes           | Yes              | —            |
| Signal K integration           | Yes           | Yes              | —            |
| International charts           | —             | —                | Subscription |
| Premium plugins                | —             | —                | Per-plugin   |
| Enhanced data feeds            | —             | —                | Subscription |

## Distribution

### iOS — App Store

- **TestFlight** for beta distribution. Supports up to 10,000 external testers, handles crash reporting.
- **App Store submission** when the app provides enough value to justify a paid listing. Requires Apple Developer Program ($99/year).
- **App Review considerations:** Navigation apps get extra scrutiny. Apple requires a privacy policy, location usage descriptions, and may question "not for primary navigation" disclaimers.

### Build & Release Pipeline

**GitHub Actions** for the full build pipeline:

1. **On PR / push:** Run tests, lint, type check
2. **On release tag:** Build production binaries via EAS Build
3. **Submission:** `eas submit` automates App Store uploads

### Release Process

1. Tag a release on `main` (`git tag v0.1.0`)
2. GitHub Actions triggers production builds
3. Builds upload to TestFlight
4. Manual review / smoke test on real devices
5. Promote to production in App Store Connect
6. Create a GitHub Release with changelog

### Versioning

Semver (`MAJOR.MINOR.PATCH`):

- **0.x.y** — Pre-release. The app works but is not yet reliable for real-world navigation. Breaking changes can happen between minor versions.
- **1.0.0** — The app is reliable enough for actual charting and navigation. A real user can depend on it for coastal navigation.
- **Post-1.0** — Semver rules apply. Patch for bug fixes, minor for new features, major for breaking changes.
