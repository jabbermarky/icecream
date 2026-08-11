# Changelog

All notable changes to Ice Ed are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-08-11

### Fixed

- **Importing an ingredient from USDA now fills in Sugar, PAC and POD.** It never
  did before. FoodData Central renamed two nutrient fields, and the import asked
  for the old names, got nothing back, and silently left the values blank — so
  every imported ingredient needed PAC and POD typed in by hand. Measured against
  the live API across 11 representative ice cream ingredients: the PAC/POD
  derivation now succeeds for 6 of 11 where it previously succeeded for 0, and
  total Sugar populates for 10 of 11 where it previously populated for none.
- **An ingredient's values now come from a single USDA record.** When a food
  appears in more than one USDA dataset, the import prefers them in a fixed order.
  The alias lookup could pick a value from a lower-priority record purely because
  the number was larger, mixing two records into one ingredient profile.
- **The app no longer depends on a third-party CDN to start.** The IndexedDB
  layer loaded its `idb` dependency from `esm.sh` at runtime, inside the startup
  path, so a CDN outage or a blocked network would prevent the app from loading.
  The library is now vendored (v8.0.3, ISC, unmodified).
- **Going offline no longer looks like a crash.** When Google's libraries are
  unreachable, cloud sync now reports it as information and continues on local
  storage, instead of logging an error for an expected and fully recoverable
  condition.

### Added

- Automated environment setup for cloud development sessions: a `SessionStart`
  hook installs dependencies and the matching browser build, and a companion
  script lets commands wait for it to finish rather than failing on a
  half-provisioned toolchain.
- A design document for the ingredient onboarding work, recording the measured
  USDA coverage data behind these fixes and the remaining task list.

### Changed

- Project documentation now records that `IceEd.html` is a frozen snapshot of the
  original single-file app rather than a supported deployment target. It predates
  these fixes and its ingredient import cannot populate PAC or POD.

[0.5.0]: https://github.com/jabbermarky/icecream/releases/tag/v0.5.0
