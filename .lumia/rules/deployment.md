# Lumia Deployment Rules

Purpose: Build, environment, database, runtime, hosting, and deployment verification.

Rules:
- Inspect deployment configuration before changing it.
- Preserve required environment variables and runtime contracts.
- Never commit secrets.
- Verify build and migration requirements before deployment.
- Distinguish code push from actual deployment success.
- Verify runtime/health/deployment status when available.
- Never claim deployment succeeded without deployment-system or live-runtime evidence.
