---
"@ikenga/cli": patch
---

Adopt Changesets for versioning + release. Version and CHANGELOG are now
derived from per-PR changeset entries and applied by CI on merge of the
"Version Packages" PR, replacing the previous tag-triggered flow.
