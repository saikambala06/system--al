import OpenAI from "openai";

interface MatchResult {
  matched: boolean;
  confidence: number;
  matchedTemplateId?: string;
  suggestedAnswer?: string;
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

// Normalize question text for comparison
function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Calculate simple similarity using word overlap
function wordOverlapSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(b.split(" ").filter((w) => w.length > 2));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}

// Key phrase extraction
function extractKeyPhrases(q: string): string[] {
  const keyPhrases = [
    "years of experience",
    "work authorization",
    "sponsorship",
    "salary expectation",
    "remote work",
    "relocation",
    "notice period",
    "current role",
    "previous company",
    "education",
    "degree",
    "certification",
    "skills",
    "programming language",
    "availability",
    "start date",
    "full name",
    "email",
    "phone number",
    "address",
    "linkedin",
    "portfolio",
    "github",
    "resume",
    "cover letter",
    "why do you want",
    "why are you interested",
    "greatest strength",
    "greatest weakness",
    "teamwork",
    "leadership",
    "conflict resolution",
    "problem solving",
    "deadline",
  ];

  const lower = q.toLowerCase();
  return keyPhrases.filter((phrase) => lower.includes(phrase));
}

function keywordBasedMatch(
  question: string,
  templates: Array<{ id: string; question: string; answer: string }>
): MatchResult | null {
  const normQuestion = normalizeQuestion(question);
  const questionPhrases = extractKeyPhrases(question);

  let bestMatch: MatchResult | null = null;

  for (const template of templates) {
    const normTemplate = normalizeQuestion(template.question);
    const templatePhrases = extractKeyPhrases(template.question);

    // Check exact normalized match
    if (normQuestion === normTemplate) {
      return {
        matched: true,
        confidence: 1.0,
        matchedTemplateId: template.id,
        suggestedAnswer: template.answer,
      };
    }

    // Check phrase overlap
    const sharedPhrases = questionPhrases.filter((p) =>
      templatePhrases.includes(p)
    );

    if (sharedPhrases.length > 0) {
      const phraseScore =
        sharedPhrases.length /
        Math.max(questionPhrases.length, templatePhrases.length, 1);
      const wordScore = wordOverlapSimilarity(normQuestion, normTemplate);
      const combinedScore = phraseScore * 0.7 + wordScore * 0.3;

      if (combinedScore > 0.5 && (!bestMatch || combinedScore > bestMatch.confidence)) {
        bestMatch = {
          matched: true,
          confidence: Math.round(combinedScore * 100) / 100,
          matchedTemplateId: template.id,
          suggestedAnswer: template.answer,
        };
      }
    } else {
      const wordScore = wordOverlapSimilarity(normQuestion, normTemplate);
      if (wordScore > 0.65 && (!bestMatch || wordScore > bestMatch.confidence)) {
        bestMatch = {
          matched: true,
          confidence: Math.round(wordScore * 100) / 100,
          matchedTemplateId: template.id,
          suggestedAnswer: template.answer,
        };
      }
    }
  }

  return bestMatch;
}

export async function matchQuestion(
  question: string,
  templates: Array<{ id: string; question: string; answer: string }>
): Promise<MatchResult> {
  // First try keyword-based matching (fast, no API cost)
  const keywordMatch = keywordBasedMatch(question, templates);
  if (keywordMatch && keywordMatch.confidence >= 0.8) {
    return keywordMatch;
  }

  // Try OpenAI if available for better matching
  const openai = getOpenAIClient();
  if (openai) {
    try {
      const templateList = templates
        .map(
          (t, i) =>
            `[${i}] Q: "${t.question}" -> A: "${t.answer.substring(0, 200)}"`
        )
        .join("\n");

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a job application form auto-fill assistant. Given a job application question and a list of previously answered questions, determine if any previous answer can be reused. Return JSON: { \"matched\": boolean, \"templateIndex\": number | null, \"confidence\": number, \"reasoning\": string }. Only match if the questions are semantically equivalent or very similar.",
          },
          {
            role: "user",
            content: `New question: "${question}"\n\nPreviously answered:\n${templateList}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const result = JSON.parse(content);
        if (result.matched && result.templateIndex !== null) {
          const template = templates[result.templateIndex];
          if (template) {
            return {
              matched: true,
              confidence: result.confidence || 0.8,
              matchedTemplateId: template.id,
              suggestedAnswer: template.answer,
            };
          }
        }
      }
    } catch {
      // Fall through to keyword result
    }
  }

  // Return keyword match if exists, otherwise no match
  return (
    keywordMatch || {
      matched: false,
      confidence: 0,
    }
  );
}

export async function batchMatchQuestions(
  questions: string[],
  templates: Array<{ id: string; question: string; answer: string }>
): Promise<Record<string, MatchResult>> {
  const results: Record<string, MatchResult> = {};

  for (const question of questions) {
    results[question] = await matchQuestion(question, templates);
  }

  return results;
}
