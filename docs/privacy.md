# Privacy Policy

_Last updated: 2026-04-28_

Open Waters is a marine navigation app published by Open Water Software, LLC ("we," "us"). This policy explains what data the app handles, why, and what control you have over it.

## Summary

- **Your location, tracks, routes, markers, and charts stay on your device.** We never receive them.
- **There are no accounts.** We don't collect your name, email, or any identifier.
- **There are no ads or third-party trackers.**
- **The app sends anonymous crash reports** to help us fix bugs. You can turn this off in Settings → Privacy.
- **Open Waters is open source** under the GPL v3. You can read every line of code at https://github.com/openwatersio/OpenWaters.

The rest of this document is the detail.

## Information stored on your device

Open Waters stores the following information locally on your device. We do not have access to any of it:

- **Location data** — your device's GPS position, used to draw your vessel on the chart, to navigate routes, and to record tracks when you start a recording. Background location collection happens only while a track is actively recording.
- **Tracks, routes, markers, and waypoints** — saved to a local database on your device.
- **Charts and offline tiles** — downloaded directly from chart providers (such as NOAA) to your device.
- **Settings and preferences** — units, theme, telemetry choice, and similar preferences are stored locally.

This information never leaves your device unless you explicitly choose to share it (for example, by exporting a GPX file or AirDrop'ing it to another device).

## Information sent off your device

Open Waters does not transmit your location, tracks, routes, markers, or any personal information to us or to any third party. The only data the app sends off your device is:

### Crash and error reports (opt-out available)

When the app crashes or hits an unexpected error, we collect a diagnostic report through [Sentry](https://sentry.io) to help us fix the bug. Reports include:

- A description of the error and the part of the code where it happened
- The app version and iOS version
- A short trail of in-app actions leading up to the error (e.g. "opened settings", "started recording")

Reports do **not** include your name, email, IP address, location, tracks, routes, markers, charts, or anything you've typed. Sentry is configured with `sendDefaultPii: false` so identifying network and device data is stripped before transmission.

You can turn this off at any time: **Settings → Privacy → Send crash reports**. When disabled, no reports are sent.

### Chart and tile downloads

When you download charts or stream tiles from online sources (such as NOAA, OpenSeaMap, OpenStreetMap), your device makes standard web requests to those services. Those services may log the request and your IP address as part of their normal operation. We don't see those logs and don't share any data with those services beyond the request itself.

### Marine instrument connections (Signal K, NMEA-0183)

When you connect Open Waters to onboard marine instruments, data flows from your boat's network into the app and stays on your device. The app uses Bonjour (mDNS) to discover instruments on your local network. No data from instrument connections is transmitted to us.

## What we do not collect

To be explicit, Open Waters does not collect, transmit, sell, or share:

- Your name, email address, phone number, or any other identifier
- Your account credentials (the app has no accounts)
- Your contacts, photos, calendar, or files outside the app
- Your IP address (Sentry is configured to drop this)
- Your advertising identifier (IDFA)
- Behavioral or analytics data beyond crash reports

We do not use third-party analytics, advertising, or tracking SDKs.

## How we use crash reports

The only information we receive is crash and error reports, and we use them only to diagnose and fix bugs. We do not sell crash reports, share them with advertisers, or use them for any purpose beyond improving the app.

## Storage and retention

- Information on your device is retained until you delete the app or use **Settings → Reset App Data** to clear it.
- Crash reports stored on Sentry's servers are retained per Sentry's standard retention. They are not linked to identity, so they cannot be retrieved by user.

## Your choices

- **Disable crash reporting**: Settings → Privacy → Send crash reports.
- **Delete all app data**: Settings → Reset App Data. This clears tracks, routes, markers, charts, and preferences from your device.
- **Revoke location permission**: iOS Settings → Open Waters → Location.
- **Uninstall the app**: removing the app from your device removes all locally stored data.

## Children

Open Waters is not directed at children under 13 and we do not knowingly collect any information from children.

## International users

Crash reports are sent to Sentry, which stores them on servers in the United States. Because reports are anonymous and not linked to identity, they do not constitute personal data under most regimes (including GDPR Article 4). If you're located in a region with applicable privacy laws (GDPR, CCPA, etc.) and want to make a data subject request, contact us — although in practice we have no data linked to you to retrieve, correct, or delete.

## Changes to this policy

When we change this policy, we'll update the "Last updated" date at the top. Material changes will be announced in the app's release notes. Continued use of the app after a change constitutes acceptance.

## Contact

Questions about this policy or privacy in Open Waters: [privacy@openwaters.io](mailto:privacy@openwaters.io).

For general support, see the [community discussion forum](https://github.com/openwatersio/OpenWaters/discussions).
