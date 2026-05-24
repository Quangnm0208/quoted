# Extensions

This directory defines extension boundaries. Implementation status as of v1.4.4:

| Extension | Status (v1.4.4) | Where it lives |
| --- | --- | --- |
| `api-keys` | **Implemented** | `src/core/middleware/apiKey.js` + `scripts/op-create-api-key.js`. This `src/extensions/api-keys/` directory is kept only as a historical placeholder. |
| `webhooks` | Placeholder | not implemented |
| `email`    | Placeholder | not implemented |
| `crm`      | Placeholder | not implemented |

Placeholder extensions must remain optional, disabled by default and unable to
block core startup.

Do not add paid providers, queues, external storage or CRM/email integrations
to the v1.4.4 core. Future candidates belong in `docs/phase-2-roadmap.md` first.
