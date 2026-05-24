# SDK Plan

SDK v0 only wraps the public API.

It does not include:

```text
admin auth
upload
direct DB access
tenant provisioning
schema mutation
```

Example:

```js
const cms = createOmniPlugClient({
  baseUrl: "https://cms.example.com",
  tenantHost: "project.example.com"
});

const site = await cms.getSiteConfig();
await cms.submitLead({ name, phone, source: "landing" });
```

The SDK must remain frontend-agnostic and work with any UI stack.
