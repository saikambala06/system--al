# SKVK Autofill Assistant

A job application autofill system:

- **Backend** - Node.js/Express + MongoDB (Mongoose), JWT auth, an autofill-matching engine
- **Website** (`public/`) - manage your profile and Q&A bank
- **Chrome extension** (`extension/`) - the thing that actually fills forms on job sites

## How matching works

1. The extension scans the visible fields on a page and reads their labels.
2. Each question is compared against your saved Q&A bank using bigram Dice-coefficient similarity (a text-overlap score from 0 to 1, threshold 0.65 by default).
3. A close match reuses the saved answer and bumps its use count.
4. A new question is sent to Gemini along with your profile data. The generated answer is filled in **and** saved to your Q&A bank, so the same or a similarly-worded question won't need another AI call next time.
5. Anything AI-generated is tagged "AI DRAFT" in the dashboard's Q&A bank tab - worth a glance; edit anything that isn't quite right and it'll be used verbatim from then on.

The threshold is intentionally on the stricter side, biased toward not reusing an answer for the wrong question (e.g. "What's your name" vs "What's your phone number" should never cross-match) at the cost of occasionally re-asking Gemini for something a looser matcher would have reused. It's `MATCH_THRESHOLD` in `src/routes/autofill.js` if you want to tune it.

## 1. Create a MongoDB Atlas cluster (free tier works)

1. https://cloud.mongodb.com -> create a free (M0) cluster.
2. **Database Access** -> add a database user with a password.
3. **Network Access** -> add `0.0.0.0/0` (or Vercel's IP ranges, if you'd rather restrict it).
4. **Connect -> Drivers** -> copy the connection string. It looks like:
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/skvk?retryWrites=true&w=majority`

## 2. Get a Gemini API key

https://aistudio.google.com/apikey - free tier is enough to develop with.

## 3. Run it locally

```bash
npm install
cp .env.example .env
# open .env and fill in MONGODB_URI, JWT_SECRET, GEMINI_API_KEY
npm run dev
```

Visit `http://localhost:5000` - register an account, fill in the Profile tab.

`JWT_SECRET` can be anything long and random:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 4. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Then, in the Vercel dashboard for the new project -> **Settings -> Environment Variables**, add `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`). Redeploy so the function picks them up:

```bash
vercel --prod
```

Your site and API now live at the same domain, e.g. `https://skvk-autofill.vercel.app` (website) and `https://skvk-autofill.vercel.app/api` (API).

## 5. Load the Chrome extension

1. Open `extension/config.js` and set `API_BASE` to `https://<your-vercel-domain>/api` and `DASHBOARD_URL` to `https://<your-vercel-domain>`.
2. If you're on a custom domain (not `*.vercel.app`), also add it to `host_permissions` in `extension/manifest.json`.
3. Chrome -> `chrome://extensions` -> enable **Developer mode** -> **Load unpacked** -> select the `extension` folder.
4. Click the extension icon and log in with the account you registered on the website.
5. On a job application page, click the floating **Autofill** button (bottom-right) or use the popup's button. **Always review filled fields before submitting** - see limitations below.

## Project layout

```
api/index.js          Vercel serverless entry point (wraps the Express app)
src/app.js             Express app: middleware, static frontend, routes
src/server.js           Local dev entry point (npm run dev)
src/config/db.js        Cached MongoDB connection (serverless-safe)
src/models/             User, Profile, QAPair (Mongoose schemas)
src/routes/              auth, profile, qa, autofill
src/utils/similarity.js  Bigram Dice coefficient matching
src/utils/gemini.js      Gemini fallback for unmatched questions
public/                 Website (login, register, dashboard)
extension/               Chrome extension (Manifest V3)
```

## Limitations, honestly

- Field detection works off visible labels, `aria-label`, `placeholder`, and nearby text - solid on standard HTML forms (Greenhouse, Lever, most company career pages). Heavily componentized UIs (some Workday instances in particular) sometimes render questions in ways that don't expose a clean label; if a field gets skipped, add it once via "Add Q&A" in the dashboard and it'll match next time a similarly-worded question shows up elsewhere.
- The AI fallback won't invent specific facts (dates, employer names) that aren't in your profile - fill in Experience/Education for anything you want it to cite exactly.
- CORS on the API is left open, since JWT is the actual security boundary; tighten `cors()` in `src/app.js` if you'd rather restrict it to your own domain(s).
- This fills forms - it doesn't submit them. Always review before hitting Submit, especially anything under "AI DRAFT."

## Natural next additions

Not built here, but would slot in cleanly given the same architecture: resume upload + parsing to auto-populate the profile, a cover-letter generator using the same profile context, and per-site adapters for the handful of ATS platforms (Workday especially) that need more than generic label-sniffing.
