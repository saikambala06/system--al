// Model names on the Gemini API change fairly often (old ones get retired
// every few months). GEMINI_MODEL lets you bump this without a code change -
// check https://ai.google.dev/gemini-api/docs/models for the current list
// if this default ever starts returning 404s.
const DEFAULT_MODEL = 'gemini-3.5-flash';

function buildProfileContext(profile) {
  if (!profile) return 'No profile data available.';

  const lines = [];
  const p = profile;

  if (p.personal) {
    const fullName = `${p.personal.firstName || ''} ${p.personal.lastName || ''}`.trim();
    if (fullName) lines.push(`Name: ${fullName}`);
    if (p.personal.firstName) lines.push(`First name: ${p.personal.firstName}`);
    if (p.personal.lastName) lines.push(`Last name: ${p.personal.lastName}`);
    if (p.personal.email) lines.push(`Email: ${p.personal.email}`);
    if (p.personal.phone) lines.push(`Phone: ${p.personal.phone}`);
    if (p.personal.address) lines.push(`Address: ${p.personal.address}`);
    if (p.personal.zip) lines.push(`Zip/Postal code: ${p.personal.zip}`);
    if (p.personal.city || p.personal.state) {
      lines.push(`Location: ${[p.personal.city, p.personal.state, p.personal.country].filter(Boolean).join(', ')}`);
    }
  }

  if (p.links) {
    if (p.links.linkedin) lines.push(`LinkedIn: ${p.links.linkedin}`);
    if (p.links.github) lines.push(`GitHub: ${p.links.github}`);
    if (p.links.portfolio) lines.push(`Portfolio: ${p.links.portfolio}`);
    if (p.links.website) lines.push(`Website: ${p.links.website}`);
  }

  if (p.summary) lines.push(`Summary: ${p.summary}`);

  if (p.experience && p.experience.length) {
    lines.push('Experience:');
    p.experience.forEach((e) => {
      lines.push(`- ${e.title || 'Role'} at ${e.company || 'Company'} (${e.startDate || '?'} - ${e.current ? 'Present' : e.endDate || '?'}): ${e.description || ''}`.trim());
    });
  }

  if (p.education && p.education.length) {
    lines.push('Education:');
    p.education.forEach((e) => {
      lines.push(`- ${e.degree || ''} in ${e.fieldOfStudy || ''}, ${e.school || ''}`.trim());
    });
  }

  if (p.skills && p.skills.length) lines.push(`Skills: ${p.skills.join(', ')}`);

  if (p.workAuth) {
    if (p.workAuth.authorizedToWork) lines.push(`Authorized to work in their country: ${p.workAuth.authorizedToWork}`);
    if (p.workAuth.requireSponsorship) lines.push(`Requires visa sponsorship: ${p.workAuth.requireSponsorship}`);
    if (p.workAuth.visaStatus) lines.push(`Visa status: ${p.workAuth.visaStatus}`);
  }

  if (p.eeo) {
    if (p.eeo.gender) lines.push(`Gender: ${p.eeo.gender}`);
    if (p.eeo.race) lines.push(`Race/ethnicity: ${p.eeo.race}`);
    if (p.eeo.veteranStatus) lines.push(`Veteran status: ${p.eeo.veteranStatus}`);
    if (p.eeo.disabilityStatus) lines.push(`Disability status: ${p.eeo.disabilityStatus}`);
  }

  if (p.preferences) {
    if (p.preferences.desiredSalary) lines.push(`Desired salary: ${p.preferences.desiredSalary}`);
    if (p.preferences.willingToRelocate) lines.push(`Willing to relocate: ${p.preferences.willingToRelocate}`);
    if (p.preferences.remotePreference) lines.push(`Remote preference: ${p.preferences.remotePreference}`);
    if (p.preferences.noticePeriod) lines.push(`Notice period: ${p.preferences.noticePeriod}`);
    if (p.preferences.earliestStartDate) lines.push(`Earliest start date: ${p.preferences.earliestStartDate}`);
  }

  return lines.length ? lines.join('\n') : 'No profile data available.';
}

async function generateAnswer(question, profile, fieldType, options) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const profileContext = buildProfileContext(profile);
  const optionsLine = options && options.length ? `\nAvailable options (choose one exactly as written): ${options.join(' | ')}` : '';

  const prompt = `You are helping a job applicant fill out a job application form. Using ONLY the applicant profile below, answer the application question truthfully and concisely, written in the applicant's own voice (first person).

Applicant profile:
${profileContext}

Application question: "${question}"
Field type: ${fieldType || 'text'}${optionsLine}

Rules:
- If field type is "select", "radio", or "checkbox" and options are listed, respond with ONLY one of the exact option strings, nothing else.
- If the question is asking for a direct profile value (name, email, phone, address, zip, LinkedIn/GitHub/portfolio/website URL, etc.) and that value is present in the profile above, return it verbatim - do not paraphrase, reformat, or add extra words.
- Do not invent specific facts (dates, employer names, numbers) that are not in the profile. If the profile lacks the detail needed, give a brief, reasonable, professional response instead of fabricating specifics.
- Keep free-text answers concise (1-3 sentences) unless the question clearly calls for more.
- Respond with ONLY the answer text - no preamble, no quotation marks, no explanation.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 300 }
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Gemini API error (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini API returned no answer (the question may have been blocked by safety filters)');
  }

  return text.trim();
}

module.exports = { generateAnswer, buildProfileContext };
