# XDevs Portal v6.2.0 — Smart Wake Scheduler

This release does not keep Render running 24/7. Instead, it wakes the free Render service only when there is likely to be a real visitor.

## Behaviour

- The Netlify homepage silently calls `/api/health` shortly after page load.
- The login page also starts a silent pre-wake.
- If a user clicks Google or Discord before Render is ready, a branded XDevs startup screen is shown while the backend wakes.
- Direct dashboard/API requests wait for the same readiness check.
- Socket.IO is loaded dynamically after readiness, so the chat client does not block page loading on a sleeping backend.

## Configuration

All timings live in `frontend/js/config.js`:

- `WAKE_HEALTH_PATH`
- `WAKE_TIMEOUT_MS`
- `WAKE_REQUEST_TIMEOUT_MS`
- `WAKE_RETRY_DELAY_MS`

No new environment variables are required.

## Important

This improves the cold-start experience but cannot make a sleeping free Render instance respond instantly. A visitor arriving directly on an OAuth callback or Render URL can still be limited by Render itself. The normal XDevs user flow through Netlify is now pre-warmed and branded.
