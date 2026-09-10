# Calculation engine research notes

Reviewed directly on 2026-08-22:

- Astro.com Sidereal Ephemeris files (Lahiri): https://www.astro.com/swisseph/sweph_sla_e.htm. The page identifies Lahiri as the sidereal zodiac commonly used by Indian astrology practitioners and lists sidereal Lahiri ephemeris files over broad historical/future ranges.
- Swiss Ephemeris information/licensing: https://www.astro.com/swisseph/swephinfo_e.htm. The official page states that Swiss Ephemeris is based on NASA JPL DE431/DE441 data, offers multiple ephemeris modes, and is distributed under a dual-license choice: AGPL or Swiss Ephemeris Professional License. The licensing choice must be made before distributing software containing it or activating a public service. The AGPL path has source/licensing obligations; the Professional path requires a commercial license contract with Astrodienst.

Implementation implication: do not add Swiss Ephemeris binaries or bindings to the production project until the license path is explicitly selected. The safest adapter boundary is a versioned server-side provider interface, with engine/ephemeris/ayanamsa settings recorded in calculation_results. A commercial public service should obtain legal/license confirmation before enabling a Swiss Ephemeris-based provider. Vimshottari and D1/D9 remain a Jyotish rules layer on top of planetary positions; the astronomical library alone does not constitute a complete Vedic interpretation engine.

Additional direct reviews:

- pyswisseph repository: https://github.com/astrorigin/pyswisseph. The repository describes a Python extension to Swiss Ephemeris, points to the Swiss Ephemeris submodule, and states that the package adopts AGPL-3. It is a low-level astronomy binding rather than a complete Vedic rules/narrative engine. The AGPL and underlying Swiss Ephemeris dual-license implications must be resolved before commercial public deployment.
- AstrologyAPI current_vdasha documentation: https://astrologyapi.com/docs/api-ref/23/current_vdasha. The endpoint is POST-based, accepts day/month/year/hour/minute/latitude/longitude/timezone, and returns current Vimshottari major/minor/sub-period dates and ruling planets. The documented supported response languages are Indian languages/English, not the project's RU/EN/DE report locales. It is an external provider with Basic-auth credentials and therefore adds vendor dependency, privacy transfer, rate limits, and reproducibility concerns.

Decision direction: prefer a provider interface with a local deterministic implementation or separately licensed calculation service behind it. Do not couple the report contract directly to AstrologyAPI response shapes. If a commercial Swiss Ephemeris license is selected, implement a thin adapter and calculate D1/D9/Vimshottari in the project's own versioned Jyotish rules layer. If licensing is not approved, keep the engine adapter disabled and do not silently substitute an unverified library.

Permissive-license candidate review:

- Astronomy Engine: https://github.com/cosinekitty/astronomy — MIT, mature multi-language project with rigorous testing, but its documented accuracy target is about ±1 arcminute and it provides astronomical positions/events, not Lahiri ayanamsa, Vimshottari, D1/D9, nakshatra or Jyotish rules. Suitable as a general astronomy/reference engine, not as the sole paid Jyotish engine without a separate sidereal/Jyotish layer and boundary-error validation.
- XALEN Ephemeris: https://github.com/vedika-io/xalen-ephemeris — Apache-2.0 stated by the repository and claims Lahiri, Vedic features, D1–D60, Vimshottari, bindings, and high accuracy. However, the official README states the Rust crates are only partially published and the Node/Python packages are not yet published; the repository is very new. It is a promising proof-of-concept candidate, not yet the safest production dependency. Requires independent benchmark against reference charts and license/NOTICE review.
- sweph-wasm: https://github.com/ptPrashantTripathi/sweph-wasm — the repository page contains conflicting MIT labeling and also says it is licensed on the same terms as Swiss Ephemeris. Because it wraps Swiss Ephemeris and has contradictory notices, it must not be treated as a permissive alternative without upstream license confirmation.
- LibEphemeris: https://github.com/g-battaglia/libephemeris — AGPL-3.0, not permissive. It has strong provenance and JPL-based design but does not meet the requested MIT/Apache constraint.
- VedAstro.Python: https://github.com/VedAstro/VedAstro.Python — official repository presents an MIT license and broad Vedic calculation coverage, but the project documentation also uses an API key/FreeAPIUser model and advertises hosted tiers. Before using it as a local production engine, verify whether every runtime component and ephemeris/data dependency is MIT/permissive, whether the intended calls are local or remote, and whether current outputs are reproducible offline.

Preliminary conclusion: there is no currently verified, mature MIT/Apache package that independently proves the complete required combination of astronomical positions + Lahiri + D1/D9 + Vimshottari with production-grade reproducibility. The safest permissive path is to evaluate XALEN as an experimental adapter and use Astronomy Engine/VedAstro only as independent comparison tools until benchmark and dependency provenance checks pass. Do not use sweph-wasm as a permissive substitute based on its conflicting README labels.

## Implementation checkpoint: August 2026

The installed `openastrology-library@1.1.1` package contains licensing and README files but no runnable `dist` or source entrypoint in the published package, so it cannot be imported as a production calculation API in this project. The first adapter implementation therefore uses the directly installed `sweph@2.10.3-5` Node binding to Swiss Ephemeris behind the project-owned `server/vedic-astrology-calculator.ts` boundary. This preserves the approved AGPL/Swiss Ephemeris direction while avoiding a fabricated API surface.

The adapter uses Lahiri sidereal mode, Moshier fallback mode when no external ephemeris path is configured, whole-sign house assignment from the calculated sidereal Ascendant, D1/D9 divisional mapping, and Vimshottari mahadasha periods derived from the sidereal Moon nakshatra. Its output is versioned as `vedic-report-calculation/v1`; it is not yet connected to client delivery or report-job execution. Production activation remains gated on reference-chart benchmark approval and a final dependency/licence review of the native binding and Swiss Ephemeris data files.

## Final free-license decision: 2026-09-08

The project selects `sweph@2.10.3-5` under **AGPL-3.0-or-later** for the free
deployment path. Astrodienst requires the choice before a public service is
activated and describes the AGPL source obligation for the whole project. The
application metadata, `LICENSE`, public source link and independent-start gate
now reflect that choice.

`openastrology-library` was removed: it was unused, its installed package lacked
the declared runtime entrypoint, and it depended on the same Swiss Ephemeris
license. Astronomy Engine was not substituted: its official scope is useful for
comparison, but it is not a complete Lahiri/D1/D9/Vimshottari engine.

The owned Jyotish layer now emits documented Parashari full-sign aspects: all
seven visible grahas aspect the seventh; Mars additionally 4/8, Jupiter 5/9 and
Saturn 3/10. Rahu/Ketu special aspects are excluded because the rule varies by
lineage. Current fixtures confirm deterministic rules, but do not replace a
benchmark against independently sourced reference charts. That benchmark
remains a production gate.

## License and runtime verification

The installed `sweph@2.10.3-5` package declares `(AGPL-3.0-or-later OR LGPL-3.0-or-later)` and includes its native prebuild/source paths in the package files. Its native Moshier fallback executed successfully offline in the local runtime. The published `openastrology-library@1.1.1` metadata declares `(AGPL-3.0 OR LGPL-3.0)` and points `main` to `./dist/index.js`, but that dist directory is absent from the installed package; the package is therefore recorded as unusable rather than silently substituted.

This implementation uses the package's declared AGPL-compatible route only as a server-side calculation boundary. The project retains the package license text and technical source/notice obligations with the dependency metadata. Automatic client delivery remains disabled until benchmark approval and explicit owner activation.
