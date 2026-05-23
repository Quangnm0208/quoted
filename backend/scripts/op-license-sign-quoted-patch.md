# Patch for op-license-sign.js — Add `--product` flag

Your existing OmniPlug `scripts/op-license-sign.js` likely signs licenses with
a single prefix (e.g., `omp_live_`). For Quoted, we need the `qtd_live_` /
`qtd_test_` prefix so the WP plugin can validate the format before round-tripping
to the backend.

## Minimal patch

Find the section that assembles the license string (search for `prefix` or
`live_` in your op-license-sign.js). Add the `--product` flag handling:

```js
// At top, with other CLI parsers:
const PRODUCT_PREFIXES = {
  omniplug: { live: 'omp_live_', test: 'omp_test_' },
  quoted:   { live: 'qtd_live_', test: 'qtd_test_' },
};

const product = argv.product || 'omniplug';
const env = (process.env.LICENSE_ENV || 'test').toLowerCase();
const prefix = PRODUCT_PREFIXES[product]?.[env];

if (!prefix) {
  console.error(`Unknown product/env combo: ${product}/${env}`);
  process.exit(1);
}

// When emitting the key:
const licenseKey = `${prefix}${base64UrlEncode(signedPayload)}`;
```

That's it. The verify side (`core/lib/licenseKey.js → verifyLicenseKey`)
should already work because the prefix is just a sentinel — the actual
signed payload structure is unchanged.

## Test the patch

```bash
LICENSE_ENV=test node scripts/op-license-sign.js \
  --email test@example.com \
  --domain test-site.local \
  --plan free \
  --days 30 \
  --product quoted

# Expected output: qtd_test_<base64url>
# Format check from WP plugin:
#   /^qtd_(live|test)_[a-zA-Z0-9_-]{20,}$/
```

If the format check passes on the plugin side, you're good.

## Production rollout

When you flip `LICENSE_ENV=live` in Fly.io secrets:
```bash
fly secrets set -a omniplug-cms-prod LICENSE_ENV=live
```

Then issue real licenses with `--product quoted` to get `qtd_live_*` keys.

## CRL compatibility

Revocation works without changes — the CRL stores license JTIs, which are
product-agnostic.
