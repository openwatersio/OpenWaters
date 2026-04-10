# Target Audience

Any mariner inclined to reach for a phone or tablet is accustomed to living with modern apps and expects a polished experience. Open Waters aims to serve three distinct user segments, each with different needs, usage patterns, and value to the project:

## Cruisers

Liveaboard and long-distance sailors who depend on their chart plotter every day for passage planning, anchoring, and coastal navigation. This is the founder's own segment and where Open Waters will have the deepest domain expertise.

- **Needs:** Offline charts (critical — often no connectivity), route planning, tides/currents, weather, integration with onboard instruments. These users push every feature to its limits.
- **Usage:** Daily, for hours at a time. Often the primary navigation display at the helm.
- **Tech comfort:** Varies. Some run very complicated setups and are willing to configure and customize, others would rather have paper charts.
- **Willingness to pay:** Moderate. Will pay for quality chart data and reliability, but value open source and data portability. Many have been burned by vendor lock-in.
- **Design implication:** Must support power-user workflows without compromising simplicity for others. Configurable information density. Offline-first is non-negotiable.

## Day Sailors

Casual and weekend sailors on boats, typically smaller boats, typically coastal or lake sailing within a day's range of home port. This is the largest addressable market and where adoption growth will come from.

- **Needs:** Simple chart viewing, GPS position, basic waypoints, weather, tides. "Does this app tell me where I am and is the water deep enough?"
- **Usage:** Intermittent — weekends, seasonal. Short sessions (2-8 hours).
- **Tech comfort:** Varies widely. App must be immediately usable without a manual.
- **Willingness to pay:** Low. Free tier must be fully functional for this segment.
- **Design implication:** Clean, uncluttered UI by default. Progressive disclosure — don't overwhelm with data. Onboarding should be near-zero friction.

## Racers

Competitive sailors (club racing through offshore) who need real-time performance data, tactical weather routing, and instrument integration. This is where commercial revenue potential is highest.

- **Needs:** Real-time instrument data (wind angle, VMG, laylines), weather routing optimized for speed, polars integration, start line tools, tactical overlays. Features Open Waters won't have in early versions.
- **Usage:** Intense but periodic — race days, regattas, deliveries.
- **Tech comfort:** Very high. Expect integration with existing racing instruments and software.
- **Willingness to pay:** High. Already spending on Expedition, PredictWind, dedicated instruments. Will pay for premium features that provide competitive advantage.
- **Design implication:** v0.3+ opportunity via plugin architecture. Don't design core UX for this segment, but don't preclude it either. Signal K integration and extensibility lay the groundwork.

See [competitive-analysis.md](competitive-analysis.md) for detailed analysis of open source and commercial alternatives.

## The core tension

The tension is between simplicity and power. The answer is **progressive disclosure** — a clean default experience that reveals depth as users need it, with extensibility that lets the community build what they need without bloating the core app.
