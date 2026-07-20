// Configuration - change this to your Vercel deployment URL in production
const API_BASE = "https://ai-jb.vercel.app";
// For production: const API_BASE = "https://your-app.vercel.app";

// ---------------------------------------------------------------------
// Multi-frame helpers
//
// Some ATS pages (Greenhouse embeds, some Workday/Lever setups) render the
// actual application form inside an <iframe>, not the top-level page. To
// reach it we need to (1) know that frame's frameId, and (2) message that
// specific frame instead of just the top page.
//
// chrome.scripting.executeScript({ target: { tabId, allFrames: true } })
// conveniently does both at once: it injects content.js into every frame
// of the tab (including frames created after the tab was first opened,
// which the manifest's one-time declarative injection can miss on tabs
// that were already open before install/reload) AND returns one result
// entry per frame, tagged with that frame's frameId — so we get the full
// frame list "for free" without needing an extra permission like
// webNavigation. content.js guards its own top-level code so re-injecting
// into a frame that already has it is a safe no-op.
// ---------------------------------------------------------------------

async function injectAndGetFrameIds(tabId) {
  let injectionResults;
  try {
    injectionResults = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["content.js"],
    });
  } catch {
    // Injection fails on restricted pages (chrome://, Web Store, PDFs, etc.)
    throw new Error(
      "Can't access this page. Try a regular job application page."
    );
  }
  return (injectionResults || []).map((r) => r.frameId);
}

async function sendToFrame(tabId, frameId, message, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await chrome.tabs.sendMessage(tabId, message, { frameId });
    } catch (err) {
      if (i === attempts - 1) throw err;
      // Listener may need a tick to register right after injection.
      await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)));
    }
  }
}

// Detect fields across every frame of the tab and merge the results.
async function collectFieldsAcrossFrames(tabId) {
  const frameIds = await injectAndGetFrameIds(tabId);
  const perFrame = []; // [{ frameId, fields }]
  let totalCount = 0;

  for (const frameId of frameIds) {
    try {
      const response = await sendToFrame(tabId, frameId, {
        action: "detectForm",
      });
      if (response?.found && response.fields?.length) {
        perFrame.push({ frameId, fields: response.fields });
        totalCount += response.fields.length;
      }
    } catch {
      // A frame that never confirms (navigated away mid-scan, cross-origin
      // edge case, etc.) is skipped rather than failing the whole detection.
    }
  }

  return { perFrame, totalCount };
}

// ---------------------------------------------------------------------
// Profile-field helpers
// ---------------------------------------------------------------------

// Case/punctuation-insensitive lookup into the profile's free-form
// `fields` map, tried against a list of likely key spellings (users may
// have saved "Gender", "gender", or "genderIdentity", etc.).
function getProfileFieldValue(profile, candidateKeys) {
  const fields = profile.fields || {};
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const lowerMap = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v) lowerMap[normalize(k)] = v;
  }
  for (const key of candidateKeys) {
    const hit = lowerMap[normalize(key)];
    if (hit) return hit;
  }
  return "";
}

const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS",
  "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK",
  "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
  "WI", "WY", "DC",
]);

// Profiles often store the full state name ("California") rather than the
// two-letter code ("CA"), especially when it was typed by hand — recognize
// those too instead of only matching codes.
const US_STATE_NAMES = new Set([
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
  "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
  "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine",
  "maryland", "massachusetts", "michigan", "minnesota", "mississippi",
  "missouri", "montana", "nebraska", "nevada", "new hampshire", "new jersey",
  "new mexico", "new york", "north carolina", "north dakota", "ohio",
  "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina",
  "south dakota", "tennessee", "texas", "utah", "vermont", "virginia",
  "washington", "west virginia", "wisconsin", "wyoming",
  "district of columbia",
]);

// Infer a Yes/No answer for "Are you located in the US?"-style questions
// from the profile's parsed address. Returns null when we genuinely can't
// tell, so the caller can flag the field for manual review instead of
// guessing.
function inferLocatedInUS(country, state) {
  const countryLower = (country || "").toLowerCase().trim();
  if (countryLower) {
    if (
      ["usa", "us", "u.s.", "u.s.a.", "united states", "united states of america"].includes(
        countryLower
      )
    ) {
      return "Yes";
    }
    return "No";
  }
  const stateRaw = (state || "").trim();
  if (US_STATE_CODES.has(stateRaw.toUpperCase())) return "Yes";
  if (US_STATE_NAMES.has(stateRaw.toLowerCase())) return "Yes";
  return null;
}

// ---------------------------------------------------------------------
// Field -> answer matching
//
// Builds the selector -> value map for one frame's detected fields. A
// saved Q&A template answer wins first; then a set of keyword rules for
// common fields; anything left over falls back to a profile.fields[question]
// exact-key lookup.
// ---------------------------------------------------------------------

function buildFillData(fields, matchResults, profile, ctx) {
  const { street, city, state, zip, country, firstName, lastName, middleName } = ctx;
  const fillData = {};
  const needsReview = [];

  for (const field of fields) {
    const q = field.label || field.name;
    const lowerQ = q.toLowerCase();

    // A saved Q&A template answer is the most specific, user-curated
    // source we have — check it FIRST, before any generic keyword rule
    // below can intercept the question.
    const qaMatch = matchResults[q];
    if (qaMatch?.matched && qaMatch?.suggestedAnswer) {
      fillData[field.selector] = qaMatch.suggestedAnswer;
      continue;
    }

    if (
      lowerQ.includes("first name") ||
      lowerQ.includes("firstname") ||
      lowerQ === "first" ||
      lowerQ === "given name"
    ) {
      fillData[field.selector] = firstName;
    } else if (
      lowerQ.includes("last name") ||
      lowerQ.includes("lastname") ||
      lowerQ.includes("surname") ||
      lowerQ === "last" ||
      lowerQ === "family name"
    ) {
      fillData[field.selector] = lastName;
    } else if (lowerQ.includes("middle name") || lowerQ.includes("middlename")) {
      fillData[field.selector] = middleName;
    } else if (lowerQ.includes("full name") || lowerQ.includes("name")) {
      fillData[field.selector] = profile.name;
    } else if (lowerQ.includes("email")) {
      fillData[field.selector] = profile.email;
    } else if (lowerQ.includes("phone") || lowerQ.includes("mobile")) {
      fillData[field.selector] = profile.phone || "";
    } else if (
      lowerQ.includes("address line 2") ||
      lowerQ.includes("address 2") ||
      lowerQ.includes("apt") ||
      lowerQ.includes("suite") ||
      lowerQ.includes("unit") ||
      lowerQ === "address2"
    ) {
      // We don't have a separate apt/suite field on the profile — leave
      // this blank instead of repeating the street address here.
      fillData[field.selector] = "";
    } else if (
      lowerQ.includes("address line 1") ||
      lowerQ.includes("address 1") ||
      lowerQ.includes("street address") ||
      lowerQ.includes("street") ||
      lowerQ === "address1"
    ) {
      fillData[field.selector] = street || profile.location || "";
    } else if (lowerQ.includes("city") || lowerQ.includes("town")) {
      fillData[field.selector] = city;
    } else if (
      lowerQ.includes("state") ||
      lowerQ.includes("province") ||
      lowerQ.includes("region")
    ) {
      fillData[field.selector] = state;
    } else if (lowerQ.includes("zip") || lowerQ.includes("postal")) {
      fillData[field.selector] = zip;
    } else if (lowerQ.includes("country")) {
      fillData[field.selector] = country;
    } else if (lowerQ.includes("location") || lowerQ.includes("address")) {
      // Generic single "Location"/"Address" field with no more specific
      // match — fine to use the full string here.
      fillData[field.selector] = profile.location || "";
    } else if (lowerQ.includes("linkedin")) {
      fillData[field.selector] = profile.linkedin || "";
    } else if (lowerQ.includes("website") || lowerQ.includes("portfolio")) {
      fillData[field.selector] = profile.website || "";
    } else if (
      lowerQ.includes("resume") ||
      lowerQ.includes("experience") ||
      lowerQ.includes("background")
    ) {
      fillData[field.selector] = profile.resumeText || "";

      // --- EEO / demographic self-identification questions ---
      // These are legally optional in the US and almost always ship with a
      // "Decline to self-identify" option, so when the profile hasn't
      // stored an explicit answer we default to that opt-out instead of
      // guessing a protected characteristic.
    } else if (
      lowerQ.includes("gender") ||
      lowerQ === "sex" ||
      lowerQ.includes("gender identity")
    ) {
      fillData[field.selector] =
        getProfileFieldValue(profile, ["gender", "sex", "genderIdentity"]) ||
        "Decline to self-identify";
    } else if (lowerQ.includes("race") || lowerQ.includes("ethnicity")) {
      fillData[field.selector] =
        getProfileFieldValue(profile, ["race", "ethnicity", "raceEthnicity"]) ||
        "Decline to self-identify";
    } else if (lowerQ.includes("veteran")) {
      fillData[field.selector] =
        getProfileFieldValue(profile, ["veteranStatus", "veteran"]) ||
        "Decline to self-identify";
    } else if (lowerQ.includes("disability")) {
      fillData[field.selector] =
        getProfileFieldValue(profile, ["disabilityStatus", "disability"]) ||
        "Decline to self-identify";

      // --- Physical location Yes/No, e.g. "Are you located in the US?" ---
      // Inferred from the profile's parsed address when possible; left for
      // manual review when we genuinely can't tell.
    } else if (
      (lowerQ.includes("located") ||
        lowerQ.includes("based") ||
        lowerQ.includes("reside") ||
        lowerQ.includes("residing") ||
        lowerQ.includes("live")) &&
      (lowerQ.includes(" us") || lowerQ.includes("u.s.") || lowerQ.includes("united states"))
    ) {
      const inferred = inferLocatedInUS(country, state);
      if (inferred) {
        fillData[field.selector] = inferred;
      } else {
        needsReview.push({ selector: field.selector, label: q });
      }

      // --- Legal work-eligibility Yes/No ---
      // Never guessed from location alone — physical location doesn't
      // determine visa/citizenship status, and getting this wrong could
      // misrepresent the applicant. Only filled from an explicit profile
      // override; otherwise flagged for manual review.
    } else if (
      lowerQ.includes("authorized to work") ||
      lowerQ.includes("eligible to work") ||
      lowerQ.includes("work authorization") ||
      lowerQ.includes("legally authorized") ||
      lowerQ.includes("sponsorship") ||
      lowerQ.includes("us citizen") ||
      lowerQ.includes("citizenship")
    ) {
      const override = getProfileFieldValue(profile, [
        "workAuthorization",
        "authorizedToWork",
        "visaSponsorship",
        "citizenshipStatus",
        "usCitizen",
      ]);
      if (override) {
        fillData[field.selector] = override;
      } else {
        needsReview.push({ selector: field.selector, label: q });
      }
    } else if (profile.fields && profile.fields[q]) {
      fillData[field.selector] = profile.fields[q];
    }
  }

  return { fillData, needsReview };
}

// DOM Elements
const notLoggedIn = document.getElementById("notLoggedIn");
const loggedIn = document.getElementById("loggedIn");
const loading = document.getElementById("loading");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const startBtn = document.getElementById("startBtn");
const actionError = document.getElementById("actionError");
const reviewNotice = document.getElementById("reviewNotice");
const logoutBtn = document.getElementById("logoutBtn");
const profileSelect = document.getElementById("profileSelect");
const profileAvatar = document.getElementById("profileAvatar");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const formInfoText = document.getElementById("formInfoText");
const fillProgress = document.getElementById("fillProgress");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");

// State
let token = null;
let user = null;
let profiles = [];

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  showState("loading");

  // Check stored token
  const stored = await chrome.storage.local.get(["token", "user", "apiBase"]);
  const base = stored.apiBase || API_BASE;

  if (stored.token && stored.user) {
    token = stored.token;
    user = stored.user;
    await loadProfiles(base);
    await detectForm();
    showState("loggedIn");
    updateUI();
  } else {
    showState("notLoggedIn");
  }
});

// Show/hide states
function showState(state) {
  notLoggedIn.classList.add("hidden");
  loggedIn.classList.add("hidden");
  loading.classList.add("hidden");

  if (state === "notLoggedIn") notLoggedIn.classList.remove("hidden");
  if (state === "loggedIn") loggedIn.classList.remove("hidden");
  if (state === "loading") loading.classList.remove("hidden");
}

// Get API base
async function getApiBase() {
  const stored = await chrome.storage.local.get(["apiBase"]);
  return stored.apiBase || API_BASE;
}

// Update logged-in UI
function updateUI() {
  if (!user) return;
  profileAvatar.textContent = user.name?.charAt(0)?.toUpperCase() || "?";
  profileName.textContent = user.name || "User";
  profileEmail.textContent = user.email || "";
}

// Load profiles
async function loadProfiles(base) {
  const apiBase = base || (await getApiBase());
  try {
    const res = await fetch(`${apiBase}/api/profiles`, {
      credentials: "include",
    });
    const data = await res.json();
    profiles = data.profiles || [];

    profileSelect.innerHTML =
      '<option value="">Select a profile...</option>';
    profiles.forEach((p) => {
      const option = document.createElement("option");
      option.value = p._id || p.id;
      option.textContent = p.name;
      profileSelect.appendChild(option);
    });
  } catch (err) {
    console.error("Failed to load profiles:", err);
  }
}

// Detect form on current page (across all frames)
async function detectForm() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return;

    const { totalCount } = await collectFieldsAcrossFrames(tab.id);

    formInfoText.textContent =
      totalCount > 0
        ? `Found ${totalCount} input fields on this page`
        : "No form fields detected. Navigate to a job application page.";
  } catch {
    formInfoText.textContent =
      "Refresh the page and try again. Form detection needs page access.";
  }
}

// Login
loginBtn.addEventListener("click", async () => {
  const email = document.getElementById("apiEmail").value.trim();
  const password = document.getElementById("apiPassword").value;
  const apiBase = await getApiBase();

  if (!email || !password) {
    loginError.textContent = "Please fill in all fields";
    loginError.classList.remove("hidden");
    return;
  }

  loginBtn.disabled = true;
  loginError.classList.add("hidden");
  loginBtn.innerHTML =
    '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span>';

  try {
    const res = await fetch(`${apiBase}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      loginError.textContent = data.error || "Login failed";
      loginError.classList.remove("hidden");
    } else {
      user = data.user;
      token = "authenticated";

      await chrome.storage.local.set({ token, user });
      await loadProfiles(apiBase);
      await detectForm();
      updateUI();
      showState("loggedIn");

      document.getElementById("apiEmail").value = "";
      document.getElementById("apiPassword").value = "";
    }
  } catch (err) {
    loginError.textContent =
      "Connection error. Is the server running at " + apiBase + "?";
    loginError.classList.remove("hidden");
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerHTML = "<span>Sign In</span>";
  }
});

// Logout
logoutBtn.addEventListener("click", async () => {
  const apiBase = await getApiBase();
  await fetch(`${apiBase}/api/auth/logout`, { method: "POST" });
  await chrome.storage.local.remove(["token", "user"]);
  token = null;
  user = null;
  profiles = [];
  showState("notLoggedIn");
});

// Start Auto-Fill
startBtn.addEventListener("click", async () => {
  const profileId = profileSelect.value;
  const apiBase = await getApiBase();

  if (!profileId) {
    actionError.textContent = "Please select a profile first";
    actionError.classList.remove("hidden");
    return;
  }

  actionError.classList.add("hidden");
  reviewNotice.classList.add("hidden");
  fillProgress.classList.remove("hidden");
  startBtn.disabled = true;
  progressFill.style.width = "10%";
  progressText.textContent = "Analyzing form fields...";

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) throw new Error("No active tab");

    const { perFrame } = await collectFieldsAcrossFrames(tab.id);

    if (!perFrame.length) {
      throw new Error("No form fields found on this page");
    }

    progressFill.style.width = "25%";
    progressText.textContent = "Getting profile data...";

    const profile = profiles.find(
      (p) => (p._id || p.id) === profileId
    );
    if (!profile) throw new Error("Profile not found");

    progressFill.style.width = "40%";
    progressText.textContent = "Matching with AI...";

    // One combined match call across every frame's questions, deduplicated
    // — the same question text (e.g. "First Name") appearing in more than
    // one frame reuses a single lookup instead of paying for it twice.
    const allFields = perFrame.flatMap((f) => f.fields);
    const questions = [...new Set(allFields.map((f) => f.label || f.name))];
    const matchRes = await fetch(`${apiBase}/api/ai/match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ questions }),
    });

    const matchData = await matchRes.json();
    const matchResults = matchData.results || {};
    progressFill.style.width = "65%";
    progressText.textContent = "Building fill data...";

    // The profile only stores one free-text "location" string (e.g.
    // "123 Main St, Springfield, IL 62701, USA"), but forms often split
    // address into separate fields. Parse it once so each field gets only
    // its own piece instead of the whole string being dumped into every
    // address-ish field (which is what caused city/address-line-2 bugs).
    const locationParts = (profile.location || "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    let street = "";
    let city = "";
    let state = "";
    let zip = "";
    let country = "";

    if (locationParts.length === 1) {
      // No commas — too ambiguous to guess city/state, treat it as a
      // single address string only.
      street = locationParts[0];
    } else if (locationParts.length === 2) {
      // "City, State" style, no street on file.
      [city, state] = locationParts;
    } else if (locationParts.length >= 3) {
      // "Street, City, State [Zip][, Country]"
      street = locationParts[0];
      city = locationParts[1];
      const stateZip = locationParts[2] || "";
      const zipMatch = stateZip.match(/\d[\d-]{3,}/);
      zip = zipMatch ? zipMatch[0] : "";
      state = stateZip.replace(zip, "").trim();
      if (locationParts.length >= 4) {
        country = locationParts[locationParts.length - 1];
      }
    }

    // Split the profile's full name once, used by first/last-name fields below.
    const nameParts = (profile.name || "").trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
    const middleName =
      nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "";

    const ctx = { street, city, state, zip, country, firstName, lastName, middleName };

    progressFill.style.width = "80%";
    progressText.textContent = "Filling form fields...";

    // Build and send fill data separately per frame — selectors are only
    // meaningful within the frame they were detected in.
    let totalFilled = 0;
    const allNeedsReview = [];
    const combinedFillData = {};

    for (const { frameId, fields } of perFrame) {
      const { fillData, needsReview } = buildFillData(
        fields,
        matchResults,
        profile,
        ctx
      );
      Object.assign(combinedFillData, fillData);
      allNeedsReview.push(...needsReview);

      const fillResponse = await sendToFrame(tab.id, frameId, {
        action: "fillForm",
        fillData,
        reviewSelectors: needsReview.map((r) => r.selector),
      });
      totalFilled += fillResponse?.filled || 0;
    }

    progressFill.style.width = "100%";
    progressText.textContent =
      `✅ Filled ${totalFilled} field${totalFilled === 1 ? "" : "s"}!`;

    if (allNeedsReview.length) {
      const preview = allNeedsReview
        .slice(0, 4)
        .map((r) => r.label)
        .join(", ");
      reviewNotice.textContent =
        `⚠️ ${allNeedsReview.length} field${allNeedsReview.length === 1 ? "" : "s"} ` +
        `need a manual answer (highlighted on the page): ${preview}` +
        (allNeedsReview.length > 4 ? "…" : "");
      reviewNotice.classList.remove("hidden");
    }

    startBtn.classList.add("success-pulse");
    setTimeout(() => startBtn.classList.remove("success-pulse"), 500);

    // Save application record
    await fetch(`${apiBase}/api/applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        profileId: profile._id || profile.id,
        jobTitle: document.title || "Unknown Position",
        company:
          new URL(tab.url).hostname.replace("www.", "") || "Unknown",
        jobUrl: tab.url,
        status: "in_progress",
        answers: combinedFillData,
      }),
    });
  } catch (err) {
    console.error("Auto-fill error:", err);
    progressText.textContent = "❌ " + (err.message || "Auto-fill failed");
    actionError.textContent = err.message || "Auto-fill failed";
    actionError.classList.remove("hidden");
  } finally {
    startBtn.disabled = false;
    setTimeout(() => {
      fillProgress.classList.add("hidden");
      progressFill.style.width = "0%";
    }, 3000);
  }
});
