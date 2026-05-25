# PaymentProvider interface

Every payment provider (Lemon Squeezy, Stripe, Paddle, …) implements this
contract. The webhook router (`payments/payments.controller.js`) and the
license service (`licenses/licenses.service.js`) read from
`providers/index.js` and never reference a provider directly.

```js
{
  id: string,                                       // 'lemon-squeezy', 'stripe', …

  // ─── Webhook verification + handling ────────────────────────────────
  // Called by POST /api/payments/webhook/:vendor.
  // Headers + raw body come straight from the HTTP request.
  verifyWebhookSignature(rawBody, headers): boolean,

  // Parse the provider-specific event payload into a vendor-agnostic shape.
  // Returns null if the event isn't recognised (caller logs + 200's).
  parseEvent(jsonBody): { event_id, event_name, raw } | null,

  // Apply the event to our DB (customers/orders/subscriptions/
  // customer_licenses/entitlements). Throws on logic failure — caller
  // records to webhook_events with error_message.
  handleEvent(event_name, jsonBody): Promise<void>,

  // ─── Checkout ───────────────────────────────────────────────────────
  // For Mode A: just return the hosted URL from env. For Mode B: call
  // the provider's Create Checkout API. Return { checkout_url }.
  createCheckout({ plan, email }): Promise<{ checkout_url: string }>,

  // ─── License lifecycle ──────────────────────────────────────────────
  // The plugin POSTs license_key to /api/v1/licenses/activate. The
  // license service hashes the key, looks up customer_licenses, then
  // delegates to the provider to confirm activation/validation/
  // deactivation against the vendor's source of truth.
  activateLicense({ license_key, instance_name }): Promise<{
    ok: boolean,
    license_meta?: { lemon_license_id, customer_email, customer_id, variant_id,
                     status, activation_limit, activation_usage, expires_at },
    error?: string,
  }>,
  validateLicense({ license_key }): Promise<{ ok, license_status }>,
  deactivateLicense({ license_key, instance_id }): Promise<{ ok }>,
}
```

## Adding a new provider

1. Create `providers/<vendor>/` with:
   - `<vendor>.client.js` — low-level HTTP wrapper
   - `<vendor>.webhook.handler.js` — event parsing + handlers
   - `index.js` — exports a PaymentProvider implementation
2. Register in `providers/index.js` (add a line to the `PROVIDERS` map).
3. Add env vars to `.env.example` for the new vendor.
4. Add tests at `tests/quoted-test-providers-<vendor>.mjs`.
5. The webhook URL `/api/payments/webhook/<vendor>` auto-dispatches.

No changes needed to `payments.controller.js`, `licenses.service.js`,
or any other module — the seam is closed.
