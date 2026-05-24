---
title: "Installation"
description: "Three ways to install Quoted on WordPress."
order: 2
---

## Option 1: WordPress.org directory (recommended)

1. In WordPress Admin, go to **Plugins → Add New**.
2. Search for **Quoted**.
3. Click **Install Now**, then **Activate**.

## Option 2: Upload a .zip file

1. Download the latest release from the [WordPress.org plugin page](https://wordpress.org/plugins/quoted/).
2. In WordPress Admin, go to **Plugins → Add New → Upload Plugin**.
3. Upload the `.zip` file and click **Install Now**, then **Activate**.

## Option 3: Symlink for local dev

```bash
cd /path/to/your/wp-content/plugins
ln -s /path/to/quoted/wp-plugin quoted
```

## After activation

After activation, Quoted runs immediately with sensible defaults. Visit
`https://your-site.com/llms.txt` to confirm the file is being served.

If you see a 404, double-check that **Settings → Permalinks** is set to
anything other than "Plain", and click **Save Changes** once to flush
rewrite rules.

## Multisite

Quoted is built for per-site activation. Network-wide activation is
intentionally blocked because each site needs its own `wp_quoted_bot_log`
table and license. Activate Quoted individually on each site that needs it.
