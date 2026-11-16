# darwin-fixture-app

A small Go route planner, and a **Darwin test fixture** that runs for days to show whether Darwin keeps up with a
repository whose dependencies keep changing:

- It depends on [darwin-fixture-geo](https://github.com/dovel-ai/darwin-fixture-geo), which publishes a release every
  12 hours: fixes, deprecations, removals, renames and a signature change. Every breaking release breaks `route/`
  until its call sites are migrated.
- Once a day a simulated developer adds a real dependency at an old release
  ([Developer activity](.github/workflows/developer.yml)).
- Every 3 hours [Darwin watch](.github/workflows/darwin-watch.yml) checks that Darwin handled each change within 30
  hours (proposed, with call sites migrated and CI passing for a breaking release; merged; or held with a reason),
  that no pull request is ready for review with failing CI, that no run is stuck, and that Darwin's console agrees
  with GitHub. The open issue **Darwin fixture watch** holds the latest report.
- [Maintainer](.github/workflows/maintainer.yml) merges Darwin's ready pull requests, only while the repository
  variable `FIXTURE_MAINTAINER_MERGES` is `true`.
