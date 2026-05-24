# Knowledge Packaging Notes

The `kb/` directory is maintainer documentation only. It is safe to ship because
it does not add a runtime process, database table, vector store or external
service.

Keep entries generic:

- Product strategy.
- Architecture rules.
- API contract.
- Migration playbook.
- Risk register.
- Launch playbook.
- Prompt-library notes.

Customer-specific copy, private case studies and implementation data do not
belong in the core package.
