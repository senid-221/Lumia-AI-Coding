# Lumia Database Rules

- Inspect the current schema and migrations before database changes.
- Preserve existing data and relationships unless a change is explicitly requested.
- Use migrations for schema changes.
- Never claim a migration succeeded without real migration output.
- Keep database credentials private.
- Scope queries to the authenticated user/project where required.
- Verify schema, migrations, and application behavior after changes.
