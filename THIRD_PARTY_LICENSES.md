# Third-party licensing notices

This file is an engineering inventory, not legal advice. The lockfile is the
authoritative version inventory and must be retained with every release.

## Swiss Ephemeris and `sweph`

The server uses `sweph@2.10.3-5`, a Node.js binding to Swiss Ephemeris. Both the
binding and Swiss Ephemeris are offered under a dual-license model:

- free network/open-source use under **AGPL-3.0-or-later**; or
- use under the terms of a separately purchased Swiss Ephemeris Professional
  License.

This repository selects the AGPL path unless the copyright holder records a
valid professional-license decision before deployment. The project therefore
uses `AGPL-3.0-or-later` and requires a visible source-code link in public
deployments. Official licensing information:

- https://www.astro.com/swisseph/swephinfo_e.htm
- https://github.com/timotejroiko/sweph

The calculation adapter uses Swiss Ephemeris for sidereal planetary positions
and the Ascendant. D1, D9, nakshatra/pada, documented Parashari full-sign
aspects, and Vimshottari mahadasha timing are implemented in this repository.
Rahu/Ketu special aspects are deliberately not asserted because lineages differ.

## Other dependencies

React, Express, tRPC, Drizzle, PDFKit, AWS SDK and other packages remain under
their respective licenses. Inspect each installed package and the `pnpm-lock.yaml`
before redistributing a build. Do not remove license files shipped inside
production dependencies.
