# Pylon Mobile

A single-file, phone-first web app for Pylon. View issues, search, and reply to tickets from your phone. Each team member signs in with their own Pylon API key, so replies are attributed correctly. No backend required.

The whole app is **one HTML file** (`pylon-mobile.html`). It stores your Pylon API key in `localStorage` on the device and talks directly to `https://api.usepylon.com` (through a tiny CORS proxy).

## What it does

- Sign in with **your own** Pylon API key — replies are attributed to you in Pylon.
- Browse issues with status counts and an assignee filter that combines with status (e.g. "On you" + "Me").
- Open an issue: read the thread, change status, add/remove tags, post a reply with a rich text editor (bold/italic/lists/links).
- Clean, vibrant UI in light or dark mode. Bottom tab nav for phone use. "Add to Home Screen" friendly.

## For team members rolling this out

If your team admin has already deployed this and shared the URL with you, here's the 60-second setup:

1. **Get your personal Pylon API key.** Open https://app.usepylon.com in your normal browser, sign in with Google as usual, then go to **Settings → API Keys** (under Developers / Integrations). Click **Create API Key**, give it a name like "My phone", and copy the key (it starts with `pylon_api_`).
2. **Open the Pylon Mobile URL** your admin shared, on your phone.
3. **Paste your API key**, expand "Advanced settings" if needed and confirm the CORS proxy URL your admin gave you, and tap **Sign in**.
4. (iPhone) Tap the share icon → **Add to Home Screen** so it launches like a native app.

That's it. Your key represents your Pylon account, so any reply you post shows up under your name, your "On you" filter shows your tickets, and your avatar appears on messages you send.

## How to use it

### Option A — open the file directly

Double-click `pylon-mobile.html`. It opens in your default browser. Paste your Pylon API key, and you're in.

This works *locally* on desktop. On a phone, you'll usually want to host it (Option B) so you can open it from a URL and add it to the home screen.

### Option B — host it for free

The file is fully static, so any static host works:

- **GitHub Pages**: push `pylon-mobile.html` to a repo, enable Pages, done.
- **Netlify Drop**: drag the file onto https://app.netlify.com/drop, done.
- **Vercel**: `vercel deploy` in a folder containing just this file.
- **Cloudflare Pages**: connect a repo, no build settings needed.

Once hosted, open the URL on your phone, then "Add to Home Screen" so it launches like a native app.

## The CORS thing (important)

Browsers block direct calls to `api.usepylon.com` because Pylon's API doesn't send CORS headers (deliberately — API keys aren't supposed to live in browser code).

You have two paths:

### 1. Deploy the tiny Cloudflare Worker proxy (recommended)

Free, takes 2 minutes, gives you a stable URL like `https://pylon-proxy.<you>.workers.dev`.

1. Sign up at https://dash.cloudflare.com (free).
2. Workers & Pages → Create → Create Worker.
3. Edit code, paste the contents of `pylon-cors-proxy.js`, click Deploy.
4. In Pylon Mobile, open **Settings → CORS proxy** and paste the Worker URL.

The Worker forwards your request to Pylon and adds the CORS header. Your API key still only lives on your device and in the request itself — the proxy doesn't store it.

### 2. Disable CORS locally (for testing only)

You can launch Chrome with `--disable-web-security` flags, but don't browse anything else with that window. Not recommended for daily use.

## Security notes

- Your Pylon API key is stored in `localStorage` on the device. Anyone with physical access to an unlocked phone could read it. Treat the device like you'd treat your password manager.
- If you deploy the proxy, lock down `ALLOWED_ORIGINS` in `pylon-cors-proxy.js` to the exact domain where you host `pylon-mobile.html` once you're past testing.
- Sign out (Settings → Sign out) wipes the key from this device.

## Pylon endpoints used

The app calls these endpoints, matching the Pylon REST conventions documented at https://docs.usepylon.com/pylon-docs/developer/api/api-reference :

| Operation | Method | Path |
|---|---|---|
| Current user | GET | `/me` |
| List/search issues | GET | `/issues` (with `query`, `state`, `limit`) |
| Get one issue | GET | `/issues/{id}` |
| List messages | GET | `/issues/{id}/messages` |
| Reply | POST | `/issues/{id}/messages` (body: `{ body, is_internal }`) |

If any path differs for your tenant, you can swap the base URL in Settings to point at a proxy that rewrites paths, or fork the HTML and edit the `Pylon = { ... }` block near the top of the script.

## What's intentionally not in this version

You asked for **view, reply, search**, so that's what's wired up. The Pylon API also supports creating issues, updating accounts, contact lookups, etc. — if you want any of those added later, the codebase has space for them: each operation is one entry in the `Pylon` object in `pylon-mobile.html`, and one view function. Easy to extend.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Network/CORS error" on sign-in | Direct browser call to Pylon blocked | Set up the Cloudflare Worker proxy (above), paste URL into Settings |
| 401 / 403 | Bad or expired API key | Settings → Change API key |
| 404 on an endpoint | Path differs for your tenant | Edit the `Pylon` object in the HTML, or use a path-rewriting proxy |
| Empty issues list | Your filter excludes everything | Tap "All" chip; clear the search box |
| Reply button does nothing | Empty textarea | Type something and try again |
| Layout broken on iPhone Safari | Old Safari version | iOS 15+ recommended (uses `100dvh`, `color-mix`) |

## File map

- `pylon-mobile.html` — the entire app. Open this in a browser.
- `pylon-cors-proxy.js` — Cloudflare Worker for CORS. Optional but usually needed.
- `README.md` — this file.
