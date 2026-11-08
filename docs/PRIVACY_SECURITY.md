# Privacy and security baseline

## Current release-candidate behavior

AsyncStorage holds guest and local-preview snapshots: inventory, basics, preferences, saved recipes, shopping, make progress, private feedback, private products, local photo URIs and simulated submissions. The build sends none of this private state to a hosted service.

Discover makes read-only HTTPS requests to the public Mixology Tools API. Those requests contain catalogue search and pagination parameters and necessarily expose ordinary connection metadata such as the device IP address to that provider. They do not include inventory, saves, preferences, private products, label references, feedback or account-preview state. Broad external recipes are visually separated from the locally reviewed Make collection. The in-app About & Privacy screen states this boundary.

Bottle scanning requests camera permission only after the user chooses the live scanner. The rear-camera preview is processed by Expo Camera for UPC-A/EAN-13 detection; this build does not take a picture, persist camera frames, upload imagery, or send scanned codes to an external product provider. A detected code is validated locally and either matched to the reviewed local fixture catalogue or carried into private manual recovery.

## Production controls

- Enforce ownership in database policies for every private row and test cross-user denial directly against the database.
- Store photos in a private bucket; accept only allow-listed image MIME types and size/dimension limits; strip metadata where practical; use short-lived signed URLs.
- Keep privileged provider, AI and catalogue operations server-side with rate limits, timeouts, output validation and audit records.
- Pin and monitor external catalogue contracts, retain source attribution, and provide a local fallback when the read-only provider is unavailable.
- Use TLS, managed encryption at rest, secret rotation and environment-isolated credentials.
- Minimise structured logs and redact tokens, email, free-text feedback, product-label text and signed URLs.
- Make submission consent explicit and preserve the exact submitted fields/photo reference independently of later private edits.
- Implement authenticated export and account deletion. Deletion must remove or anonymise user rows, objects, queued jobs and searchable logs under the approved schedule; document backup expiry.

## Verification

Before launch, test unauthenticated access, user A/user B isolation, expired/replayed signed URLs, oversized and spoofed uploads, duplicate callbacks, brute-force/rate-limit behavior, secret scanning, dependency audit, account deletion and restore behavior. Store declarations must be derived from the deployed build, SDKs and providers—not from this document alone.

The iOS configuration declares app-specific UserDefaults access (`CA92.1`) for local settings. Inspect the final native archive and third-party privacy manifests before submission because native dependencies can change the required-reason set.
