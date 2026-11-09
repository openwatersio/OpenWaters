# Licensing: GPLv3, the iOS App Store, and our CLA

The GPLv3 and Apple's iOS App Store Terms of Service contain fundamentally incompatible requirements:

1. **DRM**: Apple wraps all App Store binaries in FairPlay DRM. GPLv3 Section 3 requires distributors to waive legal power to forbid circumvention of technological protection measures.

2. **Additional restrictions**: Apple's Usage Rules limit installation to authorized devices and require acceptance of Apple's ToS. GPLv3 Section 10 states "You may not impose any further restrictions on the recipients' exercise of the rights granted herein."

3. **Anti-tivoization**: GPLv3 Section 6 requires providing "Installation Information" for User Products (which includes iPhones) — the keys and procedures needed to install modified versions. Apple does not permit sideloading modified App Store binaries, and distributors cannot provide Apple's signing keys.

The FSF confirmed this incompatibility in 2010 through enforcement actions against GNU Go on the App Store. Apple removed the app rather than change its terms. VLC was similarly removed in 2011 after a contributor complaint; VideoLAN resolved it by relicensing libVLC to LGPLv2.1+.

## Copyright Holder Exception

A copyright holder cannot violate their own license. Per the [GNU GPL FAQ](https://www.gnu.org/licenses/gpl-faq.html#DeveloperViolate):

> "The developer itself is not bound by it, so no matter what the developer does, this is not a 'violation' of the GPL."

If Open Water Software, LLC is the sole copyright holder (or holds sufficient rights from all contributors), it can simultaneously:

- License the source code to the public under GPLv3
- Distribute the compiled app through the App Store under Apple's terms

This is not dual licensing — the public license remains GPLv3. It is the copyright holder exercising its inherent right to distribute its own work.

## Contributor License Agreement

**The complication arises with external contributions.** A contributor's code enters under GPLv3, and distributing it with Apple's additional restrictions would violate _their_ GPL grant — unless the project holds broader rights.

This is where the [Contributor License Agreement](../CLA.md) comes in. Modeled on [Signal's CLA](https://signal.org/cla/), it grants Open Water Software, LLC a broad, sublicensable copyright and patent license over all contributions, while:

- Contributors **retain full copyright** ownership of their work
- The project commits to always releasing contributions under an **OSI-approved open source license**
- The grant is broad enough to permit App Store distribution without violating any contributor's rights

Signal (AGPLv3) uses this exact approach to distribute on the iOS App Store. Their CLA grants Signal Messenger the same broad rights, enabling App Store distribution despite AGPL's even stricter network-use clause.

## CLA automation

The CLA workflow records signatures in `.cla.json` on `main` using the organization-owned Open Waters CLA App. The App has Single file write permission for `.cla.json` and Metadata read permission. It needs a bypass in any ruleset that would reject its signature commits; the ordinary GitHub Actions token does not need a bypass.

Maintainers configure the organization variable `CLA_APP_CLIENT_ID` and encrypted Actions secret `CLA_APP_PRIVATE_KEY`, restricted to the participating repositories. The workflow creates a short-lived token scoped to this repository. Never check out or execute pull-request code in the privileged CLA workflow. See the [shared setup guide](https://github.com/openwatersio/cla-github-action/blob/master/docs/open-waters.md).

Each pull request runs the secret-free `CLA trigger` workflow. When it completes, the CLA workflow runs from `main`, checks the open pull request whose head is that commit, and sets a `cla` commit status on it. Human comments mentioning the CLA or `recheck` reach the action's signing-text validation and update the status. Claude co-author metadata is exempt, while human contributors must sign. If storage rejects a write, the check fails; comment `recheck` to retry. The workflow result and `.cla.json` are authoritative even if a bot comment has already acknowledged signing.

## References

- [GNU GPL FAQ: Developer Violation](https://www.gnu.org/licenses/gpl-faq.html#DeveloperViolate)
- [FSF: Why free software and Apple's iPhone don't mix](https://www.fsf.org/news/2010-05-app-store-compliance) — FSF's 2010 position on GPL/App Store incompatibility
- [VLC and the App Store](https://blog.videolan.org/2011/01/12/vlc-for-ios-dropped-from-app-store/) — VideoLAN's account of the VLC removal
- [GPLv3 Full Text](https://www.gnu.org/licenses/gpl-3.0.html) — Sections 3, 6, and 10
- [Signal CLA](https://signal.org/cla/)
