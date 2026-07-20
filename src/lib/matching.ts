// Core matching engine used to map a job-application field label to an
// answer, using (in priority order): exact/fuzzy match against saved
// question/answer pairs, rule-based profile field mapping, and, if an
// OPENAI_API_KEY is configured, an AI semantic-matching fallback.

export type ProfileRecord = Record<string, unknown>;

export type QaPairRecord = {
  id: string;
  question: string;
  questionNormalized: string;
  answer: string;
  category?: string | null;
};

export type IncomingField = {
  id: string;
  label: string;
  type?: string;
  options?: string[];
};

export type MatchResult = {
  id: string;
  value: string;
  confidence: number;
  source: "qa" | "profile" | "ai" | "none";
  matchedQuestion?: string;
};

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(input: string): Set<string> {
  return new Set(normalizeText(input).split(" ").filter(Boolean));
}

// Jaccard similarity between token sets, weighted with a substring bonus.
export function similarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const ta = tokenize(na);
  const tb = tokenize(nb);
  const intersection = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  const jaccard = union === 0 ? 0 : intersection / union;

  const substringBonus = na.includes(nb) || nb.includes(na) ? 0.15 : 0;

  return Math.min(1, jaccard + substringBonus);
}

export function findBestQaMatch(
  label: string,
  qaPairs: QaPairRecord[],
): { qa: QaPairRecord; score: number } | null {
  let best: { qa: QaPairRecord; score: number } | null = null;
  for (const qa of qaPairs) {
    const score = similarity(label, qa.question);
    if (!best || score > best.score) {
      best = { qa, score };
    }
  }
  if (best && best.score >= 0.45) return best;
  return null;
}

// Rule-based dictionary mapping normalized regex patterns -> profile field.
const FIELD_RULES: { pattern: RegExp; field: string }[] = [
  { pattern: /first\s*name/, field: "firstName" },
  { pattern: /last\s*name|surname|family\s*name/, field: "lastName" },
  { pattern: /full\s*name|^name$|legal\s*name/, field: "fullName" },
  { pattern: /e[\s-]?mail/, field: "email" },
  { pattern: /phone|mobile|contact\s*number/, field: "phone" },
  { pattern: /street\s*address|address\s*line|^address$/, field: "address" },
  { pattern: /city|town/, field: "city" },
  { pattern: /state|province|region/, field: "state" },
  { pattern: /zip|postal/, field: "zip" },
  { pattern: /country/, field: "country" },
  { pattern: /linkedin/, field: "linkedin" },
  { pattern: /github|gitlab/, field: "github" },
  { pattern: /portfolio/, field: "portfolio" },
  { pattern: /website|personal\s*site/, field: "website" },
  { pattern: /current\s*title|job\s*title|position\s*title/, field: "currentTitle" },
  { pattern: /current\s*(company|employer)/, field: "currentCompany" },
  { pattern: /years?\s*of\s*experience|total\s*experience/, field: "yearsExperience" },
  { pattern: /expected\s*(salary|compensation)|desired\s*salary|salary\s*expectation/, field: "expectedSalary" },
  { pattern: /notice\s*period|availability\s*to\s*start|start\s*date/, field: "noticePeriod" },
  { pattern: /work\s*authoriz|authorized\s*to\s*work|legally\s*authorized/, field: "workAuthorization" },
  { pattern: /sponsorship|require\s*visa|need\s*visa/, field: "needsSponsorship" },
  { pattern: /relocat/, field: "willingToRelocate" },
  { pattern: /gender|sex\b/, field: "gender" },
  { pattern: /veteran/, field: "veteranStatus" },
  { pattern: /disabilit/, field: "disabilityStatus" },
  { pattern: /race|ethnicity/, field: "race" },
  { pattern: /summary|about\s*yourself|professional\s*summary/, field: "summary" },
  { pattern: /cover\s*letter|why\s*(do\s*you\s*want|are\s*you\s*interested)/, field: "coverLetter" },
  { pattern: /skills?/, field: "skills" },
];

export function matchProfileField(label: string): string | null {
  const normalized = normalizeText(label);
  for (const rule of FIELD_RULES) {
    if (rule.pattern.test(normalized)) return rule.field;
  }
  return null;
}

export function resolveProfileValue(profile: ProfileRecord, field: string): string {
  if (field === "fullName") {
    const first = (profile.firstName as string) || "";
    const last = (profile.lastName as string) || "";
    return `${first} ${last}`.trim();
  }
  if (field === "skills") {
    const skills = profile.skills as string[] | undefined;
    return Array.isArray(skills) ? skills.join(", ") : "";
  }
  const value = profile[field];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

async function callOpenAiForMatch(
  field: IncomingField,
  profile: ProfileRecord,
  qaPairs: QaPairRecord[],
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const context = {
      profile,
      savedAnswers: qaPairs.slice(0, 60).map((q) => ({ question: q.question, answer: q.answer })),
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 200,
        messages: [
          {
            role: "system",
            content:
              "You fill job application forms for a candidate. Given the candidate's profile and previously answered questions, answer the new form field as the candidate would. Reply with ONLY the answer text, no explanation, no quotes. If it's a yes/no question infer the most reasonable answer from the profile. If truly unknown, reply with an empty string.",
          },
          {
            role: "user",
            content: `Candidate context (JSON): ${JSON.stringify(context)}\n\nForm field label: "${field.label}"\nField type: ${field.type || "text"}\n${field.options?.length ? `Available options: ${field.options.join(" | ")}` : ""}\n\nAnswer:`,
          },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return typeof text === "string" && text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

export async function matchFields(
  fields: IncomingField[],
  profile: ProfileRecord,
  qaPairs: QaPairRecord[],
  useAi: boolean,
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];

  for (const field of fields) {
    if (!field.label || !field.label.trim()) {
      results.push({ id: field.id, value: "", confidence: 0, source: "none" });
      continue;
    }

    // 1) Try saved Q&A pairs first (learns over time, highest priority).
    const qaMatch = findBestQaMatch(field.label, qaPairs);
    if (qaMatch && qaMatch.score >= 0.6) {
      results.push({
        id: field.id,
        value: qaMatch.qa.answer,
        confidence: qaMatch.score,
        source: "qa",
        matchedQuestion: qaMatch.qa.question,
      });
      continue;
    }

    // 2) Try rule-based profile field mapping.
    const ruleField = matchProfileField(field.label);
    if (ruleField) {
      const value = resolveProfileValue(profile, ruleField);
      if (value) {
        results.push({ id: field.id, value, confidence: 0.85, source: "profile" });
        continue;
      }
    }

    // 3) Weaker Q&A match still usable if nothing better exists.
    if (qaMatch && qaMatch.score >= 0.45) {
      results.push({
        id: field.id,
        value: qaMatch.qa.answer,
        confidence: qaMatch.score,
        source: "qa",
        matchedQuestion: qaMatch.qa.question,
      });
      continue;
    }

    // 4) AI semantic fallback for anything unresolved.
    if (useAi) {
      const aiValue = await callOpenAiForMatch(field, profile, qaPairs);
      if (aiValue) {
        results.push({ id: field.id, value: aiValue, confidence: 0.7, source: "ai" });
        continue;
      }
    }

    results.push({ id: field.id, value: "", confidence: 0, source: "none" });
  }

  return results;
}
