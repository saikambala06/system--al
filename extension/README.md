# AutoFillAI Browser Extension

A Manifest V3 Chrome/Edge/Brave extension that connects to your AutoFillAI
dashboard and autofills job application forms — plain HTML forms as well as
React, Vue, and Angular powered application builders (Greenhouse, Lever,
Workday, custom career sites, etc).

## Install (unpacked, works today)

1. Deploy the AutoFillAI web app (see the project root README) and sign up
   for an account.
2. Go to **Dashboard → Extension** and click **New token** to generate an
   access token.
3. Open `chrome://extensions` (or `edge://extensions`), enable **Developer
   mode**, then click **Load unpacked** and select this `extension/` folder.
4. Click the AutoFillAI icon in your browser toolbar.
5. Paste your deployed dashboard URL (e.g. `https://your-app.vercel.app`)
   and the access token, then click **Connect account**.

## Use it

1. Open any job application page.
2. Click the AutoFillAI extension icon — the popup opens instantly.
3. Click **Start Autofill**.
4. The extension scans every input, textarea, select, and radio/checkbox
   group on the page, matches each label against your saved profile and
   Q&A answers (using the AI matching engine), and fills them in
   automatically — always double check sensitive fields before submitting.

## How the matching works

- The content script extracts a "question" for every field using its
  `aria-label`, associated `<label>`, `placeholder`, or nearby text — this
  makes it accurate even on JS-framework-built forms with no semantic
  `<label>` elements.
- Fields are matched against your saved Q&A library first (fuzzy text
  matching), then against structured profile fields (name, email, phone,
  links, work authorization, etc.), and finally — if configured — an AI
  model fills in anything new and saves it back to your account so future
  applications are even faster.
- All network requests happen in the background service worker so they
  work across any origin without being blocked by a job site's CSP or CORS
  policy.
