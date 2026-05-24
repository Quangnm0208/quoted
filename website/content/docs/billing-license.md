---
title: "Billing and License"
description: "How licensing, billing, and seat management work."
order: 9
---

## Billing provider

Billing is handled by [Lemon Squeezy](https://www.lemonsqueezy.com/), a
merchant-of-record platform that handles VAT and sales tax for your region
automatically.

## Activating your license

After purchase, you receive a license key by email. In WordPress Admin:

1. Go to **Quoted → Settings → License**.
2. Paste your key.
3. Click **Activate**.

The plugin calls Lemon Squeezy&apos;s License API directly — no data passes
through any Quoted-operated server.

## Seat limits

- **Starter** — 1 site.
- **Pro** — up to 5 sites.

Each WordPress site activates with the same key. The Lemon Squeezy
dashboard shows your current activations.

## Moving to a new domain

License keys are bound to the domain you activated from, as an anti-resale
measure. If you move a site from `staging.example.com` to `example.com`:

1. In Lemon Squeezy customer portal, go to your license.
2. Find the staging instance and click **Deactivate**.
3. On the new domain, paste the same key and click **Activate**.

## Cancelling

Cancel any time from the Lemon Squeezy customer portal. Your plan stays
active until the end of the current billing period. After that, the plugin
reverts to the Free tier:

- You keep `/llms.txt`, Markdown endpoints, schema, allowlist, and 7-day
  local bot history.
- Pro-only features (Live AI Test, citation tracking, extended history)
  lock until you reactivate.

## Refunds

Lemon Squeezy honors a 14-day no-questions-asked refund policy. Email
support if you need help.
