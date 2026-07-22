// Direct label -> Profile field mapping.
//
// The bank/Gemini pipeline in autofill.js is great for open-ended questions,
// but it's the wrong tool for "First Name", "Email", "Phone", etc: those
// should come straight from the Profile tab, not from an AI guess that has
// to be regenerated (and can fail, get safety-filtered, or come back
// mis-worded) on every single application. This module is checked BEFORE
// the bank/Gemini fallback so well-known profile fields fill instantly and
// deterministically, with zero dependency on the Gemini API being up.
//
// Patterns are ordered most-specific-first because matching stops at the
// first hit - e.g. "first name" must be tested before the bare "name"
// fallback, or every name field would resolve to the combined full name.

function get(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

// Each entry: { test: RegExp, path: 'dot.path.into.profile' } or
// { test: RegExp, resolve: profile => value } for anything that isn't a
// plain 1:1 field (full name, skills list, etc).
const RULES = [
  { test: /\bfirst\s*name\b|\bgiven\s*name\b/i, path: 'personal.firstName' },
  { test: /\b(last\s*name|surname|family\s*name)\b/i, path: 'personal.lastName' },
  {
    test: /\b(full\s*name|legal\s*name|applicant\s*name)\b|^name$/i,
    resolve: (p) => [p.personal?.firstName, p.personal?.lastName].filter(Boolean).join(' ')
  },
  { test: /e-?mail/i, path: 'personal.email' },
  { test: /\b(phone|mobile|cell|telephone|contact\s*number)\b/i, path: 'personal.phone' },
  { test: /linkedin/i, path: 'links.linkedin' },
  { test: /github/i, path: 'links.github' },
  { test: /portfolio/i, path: 'links.portfolio' },
  { test: /\b(website|personal\s*site)\b/i, path: 'links.website' },
  { test: /\b(street\s*address|mailing\s*address|home\s*address|address\s*line)\b|^address$/i, path: 'personal.address' },
  { test: /\bcity\b/i, path: 'personal.city' },
  { test: /\b(state|province)\b/i, path: 'personal.state' },
  { test: /\b(zip|postal\s*code|post\s*code)\b/i, path: 'personal.zip' },
  { test: /\bcountry\b/i, path: 'personal.country' },
  { test: /\b(authoriz(e|ation)d?\s*to\s*work|legally\s*authorized|work\s*authorization)\b/i, path: 'workAuth.authorizedToWork' },
  { test: /\bsponsorship\b/i, path: 'workAuth.requireSponsorship' },
  { test: /\bvisa\s*status\b/i, path: 'workAuth.visaStatus' },
  { test: /\b(desired|expected)\s*salary\b|\bsalary\s*expectation\b|\bcompensation\s*expectation\b/i, path: 'preferences.desiredSalary' },
  { test: /relocat/i, path: 'preferences.willingToRelocate' },
  { test: /\b(remote|onsite|hybrid|work\s*location)\s*preference\b|\bremote\b/i, path: 'preferences.remotePreference' },
  { test: /\bnotice\s*period\b/i, path: 'preferences.noticePeriod' },
  { test: /\b(earliest\s*start\s*date|available\s*start\s*date|start\s*date)\b/i, path: 'preferences.earliestStartDate' },
  { test: /\bgender\b/i, path: 'eeo.gender' },
  { test: /\b(race|ethnicity)\b/i, path: 'eeo.race' },
  { test: /\bveteran\b/i, path: 'eeo.veteranStatus' },
  { test: /\bdisability\b/i, path: 'eeo.disabilityStatus' },
  { test: /\b(summary|about\s*you|about\s*yourself|professional\s*summary)\b/i, path: 'summary' },
  { test: /\bskills\b/i, resolve: (p) => (p.skills || []).join(', ') }
];

// For select/radio/checkbox fields, the raw profile value ("No") needs to
// land on whichever exact option text the site used ("No, I do not require
// sponsorship"). Same matching approach content.js already uses client-side.
function matchOption(value, options) {
  if (!options || !options.length) return value;
  const lower = String(value).trim().toLowerCase();
  if (!lower) return null;
  const exact = options.find((o) => o.trim().toLowerCase() === lower);
  if (exact) return exact;
  const partial = options.find((o) => o.trim().toLowerCase().includes(lower) || lower.includes(o.trim().toLowerCase()));
  return partial || null; // no reasonable option match -> let it fall through to Gemini
}

// Returns { value, path } or null if nothing in the profile maps to this label.
function matchProfileField(label, profile, fieldType, options) {
  if (!profile || !label) return null;

  // A label can technically satisfy more than one rule (e.g. "...in this
  // country" contains the standalone word "country" even when the field is
  // really about work authorization). Don't just take the first rule in
  // list order - pick whichever rule's matched phrase is longest, since the
  // longer/more specific phrase is the better description of what the field
  // is actually asking. Ties keep the earlier rule's priority.
  let rule = null;
  let bestLen = -1;
  for (const r of RULES) {
    const m = label.match(r.test);
    if (m && m[0].length > bestLen) {
      bestLen = m[0].length;
      rule = r;
    }
  }
  if (!rule) return null;

  const raw = rule.resolve ? rule.resolve(profile) : get(profile, rule.path);
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;

  if (['select', 'radio', 'checkbox'].includes(fieldType) && options && options.length) {
    const mapped = matchOption(raw, options);
    if (!mapped) return null;
    return { value: mapped, path: rule.path };
  }

  return { value: String(raw), path: rule.path };
}

module.exports = { matchProfileField };
