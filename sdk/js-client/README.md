# @quoted/sdk

Typed JavaScript client for the [Quoted](https://quotedeasy.com) backend.
The same contract the official WordPress plugin uses, but for JS runtimes
(Node, Next.js, Astro, edge workers, browser).

## Install

```bash
npm install @quoted/sdk
```

## Quick start

### Public — checkout flow (browser or SSR)

```js
import { QuotedClient } from '@quoted/sdk';

const client = new QuotedClient({ baseUrl: 'https://api.quotedeasy.com' });

document.querySelector('#buy-pro').onclick = async () => {
  const { checkout_url } = await client.payments.checkout({ plan: 'pro-monthly' });
  window.location.href = checkout_url;
};
```

### Server-side — license activation + site registration

```js
import { QuotedClient, QuotedError } from '@quoted/sdk';

const client = new QuotedClient({ baseUrl: process.env.QUOTED_API });

try {
  await client.licenses.activate({
    license_key: 'abc12345-6789-0000-0000-000000000001',
    site_url: 'https://my-site.com',
    plugin_version: '1.0.0',
    wp_version: '6.5',
  });
  // activation_token is cached on the client; register uses it automatically.
  await client.wpSites.register({
    domain: 'my-site.com',
    site_name: 'My Site',
    admin_email: 'me@my-site.com',
  });
  // plugin JWT is also cached now; runtime endpoints will work.
  const summary = await client.dashboard.summary(7);
  console.log(summary.ai_distribution_score);
} catch (err) {
  if (err instanceof QuotedError) {
    console.error(`[${err.code}] ${err.message}`, err.details);
  } else {
    throw err;
  }
}
```

## API

The client mirrors the contract at
[`backend/omniplug/src/backend/modules/_contracts/`](../../backend/omniplug/src/backend/modules/_contracts/index.js).
TypeScript types ship in `src/index.d.ts`.

| Method | Endpoint |
|---|---|
| `client.payments.checkout({ plan, email? })` | `POST /api/payments/checkout` |
| `client.products.plans()` | `GET /api/products/plans` |
| `client.licenses.activate({ license_key, site_url, ... })` | `POST /api/v1/licenses/activate` |
| `client.licenses.validate({ site_url })` | `POST /api/v1/licenses/validate` |
| `client.licenses.deactivate({ site_url, license_key? })` | `POST /api/v1/licenses/deactivate` |
| `client.wpSites.register({ domain, ... })` | `POST /api/v1/wp-sites/register` |
| `client.wpSites.refreshToken()` | `POST /api/v1/wp-sites/refresh-token` |
| `client.wpSites.postsSync({ posts })` | `POST /api/v1/wp-sites/posts/sync` |
| `client.botCrawls.batch({ events })` | `POST /api/v1/bot-crawls/batch` |
| `client.dashboard.summary(days?)` | `GET /api/v1/dashboard/summary` |

## Errors

Every method throws `QuotedError` on backend error envelope or network
failure. `err.code` mirrors the backend's stable code strings:

| code | Meaning |
|---|---|
| `INVALID_PLAN` | Plan id not recognised |
| `LICENSE_NOT_FOUND` | Key not in our DB and LS rejected it |
| `LICENSE_EXPIRED` | Past `expires_at` |
| `LICENSE_DISABLED` | Cancelled / refunded |
| `ACTIVATION_LIMIT_REACHED` | All seats used |
| `TOKEN_INVALID` | Activation token expired or malformed |
| `RATE_LIMITED` | Try again in a minute |
| `NETWORK_ERROR` | Fetch failed |

## License

GPL-2.0-or-later
