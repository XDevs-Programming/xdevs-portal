# XDevs Portal v6.1.0 — Legal & Transparency

## Added

- Privacy Policy at `/privacy`
- Terms of Service at `/terms`
- Public changelog at `/changelog`
- OAuth sign-in acknowledgement linking to Terms and Privacy
- Portal version displayed on public footer and dashboard sidebars
- Central frontend version in `frontend/js/config.js`
- Backend package version updated to `6.1.0`
- `GET /api/version`
- API health response now includes the deployed version

## Important before publishing

The Privacy Policy deliberately does not invent an email address for XDevs Programming.

If you have a business/privacy contact email, set this in:

`frontend/js/config.js`

Example:

```js
LEGAL_CONTACT_EMAIL: "your-real-email@example.com"
```

The legal pages will automatically display that address.

## Legal note

The supplied pages are written to reflect the current portal functionality and UK-facing privacy/consumer considerations, but they are not a substitute for advice from a qualified solicitor or data-protection professional. Review them when your business model, payment terms, data retention or service providers change.
