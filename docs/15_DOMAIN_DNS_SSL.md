# 15 — Domain, DNS, SSL

> **Step-by-step CEO walkthrough:** [`GO_LIVE_GUIDE.md`](./GO_LIVE_GUIDE.md) steps 1, 4, 6 cover this end-to-end.
> This file is a quick reference.

## Recommended setup

| Item | Recommendation | Why |
|---|---|---|
| Domain registrar | Cloudflare Registrar | at-cost pricing (~$10/yr `.com`), auto-binds to CF DNS, SSL included |
| DNS provider | Cloudflare | free tier covers everything we need |
| Apex (`quotedeasy.com`) | Cloudflare Pages | static site hosting |
| Subdomain (`api.quotedeasy.com`) | Fly.io | backend API |
| SSL | Automatic — both providers issue free certs (Cloudflare Universal SSL + Fly automatic Let's Encrypt) | No manual cert management |

## DNS records (exact)

After backend deploy on Fly:

```bash
flyctl ips list -a quoted-api
# captures v4 IP, v6 IP
```

In Cloudflare DNS → quotedeasy.com → Records:

| Type | Name | Content | Proxy | TTL |
|---|---|---|---|---|
| `A` | `api` | (Fly v4 IP) | **DNS only** (xám) | Auto |
| `AAAA` | `api` | (Fly v6 IP) | **DNS only** (xám) | Auto |

For frontend (apex) → Cloudflare Pages handles this automatically when you bind a custom domain via Pages dashboard.

## SSL setup

| Layer | Provider | How |
|---|---|---|
| `api.quotedeasy.com` | Fly automatic Let's Encrypt | `flyctl certs create api.quotedeasy.com -a quoted-api` |
| `quotedeasy.com` (Pages) | Cloudflare Universal SSL | auto-issued when domain bound to Pages project |
| Cloudflare proxy mode | "Full (strict)" | required if you ever turn on the orange-cloud proxy in front of Fly |

**Critical rule:** Do NOT enable Cloudflare proxy (orange cloud) on the `api.*` record until you've confirmed Cloudflare SSL mode is "Full (strict)". Default "Flexible" mode would terminate SSL at CF and forward plain HTTP — would break Fly's HSTS expectations and corrupt webhook HMAC verification.

## Verification

After all DNS propagates (1-5 min):

```bash
# Should return 200 + valid cert
curl -I https://quotedeasy.com/
curl -I https://api.quotedeasy.com/api/health

# Show cert chain
openssl s_client -connect quotedeasy.com:443 -servername quotedeasy.com < /dev/null 2>/dev/null | openssl x509 -noout -dates
openssl s_client -connect api.quotedeasy.com:443 -servername api.quotedeasy.com < /dev/null 2>/dev/null | openssl x509 -noout -dates

# DNS sanity
dig +short api.quotedeasy.com           # should match Fly IP
dig +short quotedeasy.com               # should resolve to Cloudflare anycast
```

## Common DNS issues

| Symptom | Cause | Fix |
|---|---|---|
| SSL not issued by Fly after 5 min | DNS still propagating or proxy on | Wait 10 min; if still no, confirm DNS is "DNS only" (xám) |
| Cloudflare Pages shows "domain pending" forever | DNS records didn't auto-add (domain not on Cloudflare nameservers) | If domain registered elsewhere, point nameservers to Cloudflare first |
| `curl https://api.quotedeasy.com` returns 521 | Fly app is down | `flyctl status -a quoted-api`; `flyctl logs -a quoted-api` |
| Webhook signature fails despite secret being correct | Cloudflare proxy modified body | Disable proxy on `api.*` (set to "DNS only") |

## If domain registered elsewhere (not Cloudflare)

1. Add the domain to Cloudflare → Sites tab → "Add a site"
2. Cloudflare scans existing DNS, lists records to import
3. Cloudflare gives you 2 nameservers to set at your registrar (Namecheap/GoDaddy/etc.)
4. Change nameservers there → wait 1-24h for propagation
5. Now follow the recommended setup above
