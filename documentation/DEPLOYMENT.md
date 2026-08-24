# Deployment guide

## 1. Backend on Render

Create a new Web Service from the repository and set:

- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`

Add all variables from `backend/.env.example`.

Your production values should resemble:

```env
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://xdeveloper.netlify.app
BACKEND_URL=https://your-render-service.onrender.com
MONGO_URI=your-working-mongodb-uri
JWT_SECRET=long-random-secret
COOKIE_SECRET=different-long-random-secret
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=https://your-render-service.onrender.com/api/auth/discord/callback
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://your-render-service.onrender.com/api/auth/google/callback
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run it twice.

## 2. Discord OAuth

Add this exact redirect URI in the Discord Developer Portal:

```text
https://your-render-service.onrender.com/api/auth/discord/callback
```

## 3. Google OAuth

Create a Web Application OAuth client.

Add:

```text
https://your-render-service.onrender.com/api/auth/google/callback
```

as an authorised redirect URI.

## 4. Frontend on Netlify

Before deployment, open:

```text
frontend/js/config.js
```

Replace the placeholder Render URL.

Deploy the entire `frontend` folder.

## 5. Promote an admin

In MongoDB, update your chosen user:

```js
db.users.updateOne(
  { email: "your-email@example.com" },
  { $set: { role: "admin" } }
)
```

Never grant admin access based only on a browser-provided username.

## 6. Final testing

Test:

1. Homepage
2. Discord login
3. Google login
4. Client dashboard
5. New commission
6. Commission updates
7. Review submission
8. Admin dashboard
9. Accept, reject and status changes
10. Logout
