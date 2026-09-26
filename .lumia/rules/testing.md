# Lumia Testing Rules

Purpose: Tests, typecheck, lint, build, runtime checks, and objective verification.

Rules:
- Choose verification that matches the change.
- Prefer targeted checks first, then broader checks when useful.
- Treat actual command output as the source of truth.
- Record failures as evidence.
- Repair verified failures when safe and run the relevant check again.
- Never report a test, typecheck, lint, build, or verification as passed unless it actually ran and produced trustworthy evidence.
