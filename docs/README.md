# docs/

Project docs. See the top-level [README.md](../README.md) for the
project landing page; what's here is reference material that
contributors and AI assistants reach for during work.

| File | What it covers |
|------|----------------|
| [conventions.md](conventions.md) | Guardrail catalog, how to add a new convention, install paths for local hooks, bypass policy, when to gate diagnostic warnings. |
| [migrations.md](migrations.md) | Seven-phase playbook for retiring a database table or column. Captures the `compliance_requirements` lessons. |
| [tenant-schema-audit.md](tenant-schema-audit.md) | Tables that still need `tenant_id` columns. Partially historical (three rows have shipped); the remainder is the live backlog. |
| [archived/](archived/README.md) | Historical reference material that's been superseded. Move-not-copy semantics enforced by the `docs-footprint` guard. |
