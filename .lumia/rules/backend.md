# Lumia Backend Rules

Purpose: APIs, services, server logic, authentication boundaries, validation, runtime behavior, and integrations.

Rules:
- Inspect the existing server architecture before modifying it.
- Preserve API contracts unless the task requires a change.
- Validate input and authorization at boundaries.
- Keep secrets server-side.
- Handle provider, tool, timeout, cancellation, and runtime errors explicitly.
- Keep external integrations bounded and observable.
- Avoid unrelated backend refactors.
- Verify backend changes with real command output.
