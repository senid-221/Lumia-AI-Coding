# Lumia Database Rules

Purpose: Schema, migrations, queries, relations, transactions, and data safety.

Rules:
- Inspect the current schema and migrations before changing database behavior.
- Understand existing relations and preserve data.
- Use migrations for schema changes.
- Scope data access to the authenticated user/project where required.
- Validate queries and input.
- Never invent tables or fields.
- Never claim migration success without real migration output.
- Verify schema and application behavior after database changes.
