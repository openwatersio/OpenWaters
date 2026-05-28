# Release Process

TestFlight builds are automated — a fresh build ships every night there are code changes (see [Automated nightly builds](#automated-nightly-builds)). This doc covers the steps that still need a human.

## Bump the marketing version (when starting a new beta cycle)

The marketing version (`expo.version` in [app.json](../app.json)) is what users see in App Store Connect and the About sheet (e.g. `0.1.3`). The nightly build does **not** touch it — it only auto-increments the build number (the integer in parens, e.g. `0.1.3 (12)`).

Bump it when:

- The release notes warrant a new "What's New" entry
- A breaking change lands that beta testers should be alerted to
- You want a fresh External Testing build (a new marketing version triggers Apple's Beta App Review again, ~24–48 h)

For incremental builds within a cycle (bug fixes, polish), leave it alone.

## Manage TestFlight testers

Once the nightly job submits a build and Apple finishes processing (~10–30 min), the App Store Connect → TestFlight work is manual:

- **Internal testing** (your team): the build is available immediately, no review. Testers get a push automatically.
- **External testing** (beta testers): a new marketing version requires **Beta App Review** (~24–48 h); subsequent builds with the same version don't. Enable the build for the external group and edit "What to Test" (reviewed by Apple, shown in the TestFlight app).

## Automated nightly builds

A GitHub Actions workflow at [.github/workflows/nightly.yml](../.github/workflows/nightly.yml) runs `eas build` + `eas submit` every day at 05:00 UTC (~1am ET, ~10pm PT) so beta testers always have a fresh build to wake up to.

The scheduled run **skips the build if there are no code changes in the last 24 hours** — doc-only commits (`docs/**`, `**.md`) don't trigger a build. Manual `workflow_dispatch` runs always build regardless.

## Ad-hoc build

Need a build right now instead of waiting for the nightly tick:

- **From GitHub**: Actions → Nightly Build → Run workflow. Always builds (skips the code-change guard).
- **From the CLI**: `eas build --profile production --platform ios` then `eas submit --profile production --platform ios --latest`.

## Promoting to the App Store (future, v1.0 path)

When a beta is stable enough to ship:

### 1. Pick a build

In App Store Connect → TestFlight, identify the build to promote. Should be one that's been live with external testers for at least a week without new crash-rate-1%+ issues (per [initial-release.md beta exit criteria](specs/initial-release.md#beta-exit-criteria)).

### 2. Create an App Store version

App Store Connect → Apps → Open Waters → **+ Version**:

- Marketing version (e.g. `1.0.0`)
- Fill in metadata (description, keywords, promotional text, screenshots, etc. — see [initial-release.md Phase 3](specs/initial-release.md#phase-3--app-store-submission))
- Most fields auto-populate from the previous version after the first submission
- Pick the build from TestFlight
- Write "What's New in This Version" (the user-facing release notes)
- Confirm the App Privacy nutrition label is current (per [initial-release.md privacy nutrition label answers](specs/initial-release.md#privacy-nutrition-label-answers))
- Verify the export compliance answer (`ITSAppUsesNonExemptEncryption: false` is set in [app.json](../app.json), so no action needed)

### 3. Submit for review

Click **Submit for Review** in App Store Connect.

Apple review: typically 1–3 days. Could be faster for an update to an existing app, slower for novel categories or apps with new privacy declarations.

### 4. Choose release timing

When you submit, choose how the release rolls out on approval:

- **Manually release** — the default; gives you a chance to coordinate the website, social posts, etc. before the App Store updates
- **Automatically release** — goes live the moment Apple approves. Avoid unless you want a Friday-evening surprise.
- **Phased release** — gradually roll out to %s of users over 7 days. Good safety net for v1.0.

### 5. After approval

- Tag the release on `main`:
  ```sh
  git tag v1.0.0
  git push origin v1.0.0
  ```
- Create a GitHub Release with the changelog
- Manually release the build in App Store Connect (if you picked "Manually release")
- Update the README and openwaters.io with the App Store link

## Quick reference

| Task                              | Command                                                    |
| --------------------------------- | ---------------------------------------------------------- |
| Build for TestFlight              | `eas build --profile production --platform ios`            |
| Submit latest build to TestFlight | `eas submit --profile production --platform ios --latest`  |
| Inspect EAS-managed credentials   | `eas credentials`                                          |
| Inspect remote build number       | `eas build:version:get --platform ios`                     |
| Manually set remote build number  | `eas build:version:set --platform ios`                     |
| Add a secret used by EAS builds   | `eas secret:create --scope project --name FOO --value bar` |
| List builds                       | `eas build:list --platform ios`                            |
