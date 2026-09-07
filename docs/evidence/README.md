# Evidence checksums

Store file fingerprints as records with separate `path` and `sha256` fields.
Compute the digest from the actual bytes using SHA-256; never use a filename as
the JSON key for a digest. Aggregate digests can use names such as `sourceSha256`.
Keep the source revision and capture context alongside the records. Historical
captures must retain their original fingerprints when later code changes.

The format is checked across all JSON evidence by
`tests/unit/evidence-checksums.test.mjs`, included in `npm run test:unit` and the
existing CI app job. The same test verifies the guided-journey screenshot bytes.
Run it directly with `node --test tests/unit/evidence-checksums.test.mjs`.
Historical source verification uses the recorded Git revision, not today's
working tree; it remains a manual evidence check because CI uses a shallow
checkout and some older captures include uncommitted source changes.

GitGuardian's [generic detector](https://docs.gitguardian.com/secrets-detection/secrets-detection-engine/detectors/generics/generic_high_entropy_secret)
considers assignment names containing `auth` sensitive. Filename keys containing
“Authoring” triggered four false positives in the original guided-journey
manifest. Explicit algorithm fields make the meaning of these values clear.
This format check is not a secret scanner and does not authorize storing secrets
under checksum field names. GitGuardian remains enabled without path or detector
exclusions.

For existing alerts, first recompute the flagged value from the recorded source
or image bytes. Only a verified match justifies marking that exact incident as a
false positive in GitGuardian. Its [PR integration](https://docs.gitguardian.com/internal-monitoring/prevent/detect-secrets-in-real-time-in-github)
scans historical commits, so a later formatting fix alone does not clear an open
incident. Disposition the verified incident, then rerun the check; do not disable
scanning or rewrite shared history to hide the alert.
