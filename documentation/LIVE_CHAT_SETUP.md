# XDevs Portal v3 — Live Chat + Mobile Dashboard Fix

## What changed

- Added Socket.IO real-time chat.
- Chats are private to a commission.
- Clients can only access their own commission chats.
- Admins can access all commission chats.
- Messages are persisted in MongoDB.
- Typing indicators are included.
- Read state/unread counts are included.
- New chat messages also create portal notifications.
- Socket authentication uses the existing JWT.
- Added Live Chat navigation to both dashboards.
- Added mobile chat layout with a conversation-list back button.
- Fixed the dashboard mobile sizing/overflow behaviour shown in the iPhone screenshot.
- Kept existing invoices, Stripe payments, pro bono commissions, secure file transfer, notifications and Past Works intact.

## Environment variables

No new environment variables are required.

The existing `FRONTEND_URL` value must remain the deployed Netlify origin, for example:

`https://xdevs-portalpoint.netlify.app`

## Deployment

Render will install the new `socket.io` dependency from `backend/package.json`.

After pushing to GitHub, redeploy the Render backend and Netlify frontend.

The Socket.IO client is loaded from:

`https://xdevs-portal.onrender.com/socket.io/socket.io.js`

If the Render service URL ever changes, update the script URL in:

- `frontend/pages/dashboard/client.html`
- `frontend/pages/dashboard/admin.html`

## Chat security

The Socket.IO connection requires the same JWT used by the existing REST API. Every room join and message send is checked server-side against the commission owner/admin role.
