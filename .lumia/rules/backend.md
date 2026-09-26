# Lumia Backend Rules

- Understand the existing server architecture before changing it.
- Preserve API contracts unless the task requires a contract change.
- Validate authentication and authorization at server boundaries.
- Validate input and handle provider/tool failures explicitly.
- Keep secrets server-side.
- Use bounded timeouts, cancellation, and useful error states where applicable.
- Verify backend changes with real command output.
