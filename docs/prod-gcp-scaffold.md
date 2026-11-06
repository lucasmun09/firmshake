# Prod GCP scaffold (design — no apply required)

Minimal inventory of **already known** `firmshake-prod` resources. Prefer Console / existing scripts over half-baked Terraform until secrets and first manual deploy exist.

## What you need to do

1. Confirm project `firmshake-prod` is on the correct billing account.
2. Confirm region **us-east1** for Cloud Run + Artifact Registry (Firestore `(default)` already us-east1).
3. Ensure deploy identity can:
   - push to Artifact Registry `firmshake`
   - deploy Cloud Run service `firmshake-api`
   - read/write GCS `firmshake-prod-images`
   - use Firebase Admin against `firmshake-prod`
4. Fill `.cloudrun.env.prod.yaml` (reCAPTCHA required; Typesense optional).
5. Run `bash scripts/deploy-prod.sh` once manually; only then consider CI `PROD_DEPLOY_ENABLED`.

## Known resources (verified empty-ready)

| Resource | Status |
|---|---|
| GCP / Firebase `firmshake-prod` | Exists |
| Firestore `(default)` us-east1 | Empty |
| Hosting site | Exists — deploy with `npm run deploy:prod` |
| Artifact Registry `firmshake` (us-east1) | Exists |
| Storage `firmshake-prod-images` | Exists |
| Cloud Run `firmshake-api` | **Not deployed** until first `deploy-prod.sh` |

## Why no Terraform in-repo yet

Applying incomplete IaC risks drift against resources already created in Console. When IaC is worth it, start with a **read-only** `terraform plan` module that imports:

- `google_cloud_run_v2_service.firmshake_api` (us-east1)
- `google_artifact_registry_repository.firmshake`
- `google_storage_bucket.firmshake_prod_images`

Do **not** manage Firebase Auth providers, Typesense, Stripe, or DNS in the first module.

## Related

- Cutover: [`prod-cutover-runbook.md`](./prod-cutover-runbook.md)
- API assert: `firmshake-api/scripts/assert-cloudrun-env.sh`
