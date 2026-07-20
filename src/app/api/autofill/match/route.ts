import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { profiles, qaPairs, fillHistory } from "@/db/schema";
import { eq } from "drizzle-orm";
import { authenticateExtensionRequest } from "@/lib/apiAuth";
import { getSession } from "@/lib/auth";
import { matchFields, normalizeText, type IncomingField } from "@/lib/matching";

export async function POST(request: NextRequest) {
  // Support both the extension (Bearer token) and the in-app "try it" demo
  // (cookie session) hitting this endpoint.
  const ext = await authenticateExtensionRequest(request);
  const session = ext ? null : await getSession();
  const userId = ext?.userId || session?.userId;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const fields = Array.isArray(body.fields) ? (body.fields as IncomingField[]) : [];
  const siteUrl = typeof body.url === "string" ? body.url : "";
  const siteTitle = typeof body.title === "string" ? body.title : "";

  if (fields.length === 0) {
    return NextResponse.json({ matches: [] });
  }

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const savedQa = await db.select().from(qaPairs).where(eq(qaPairs.userId, userId));

  const useAi = Boolean(process.env.OPENAI_API_KEY);
  const matches = await matchFields(fields, profile || {}, savedQa, useAi);

  // Learn: persist newly-answered AI matches so future forms reuse them
  // instantly without another AI call.
  const learnable = matches.filter((m) => m.source === "ai" && m.value);
  for (const m of learnable) {
    const field = fields.find((f) => f.id === m.id);
    if (!field) continue;
    const normalized = normalizeText(field.label);
    try {
      await db
        .insert(qaPairs)
        .values({
          userId,
          question: field.label,
          questionNormalized: normalized,
          answer: m.value,
          category: "ai-learned",
          source: "ai",
        })
        .onConflictDoNothing();
    } catch {
      // ignore learning failures, non-critical
    }
  }

  if (siteUrl) {
    const filledCount = matches.filter((m) => m.value).length;
    try {
      await db.insert(fillHistory).values({
        userId,
        siteUrl,
        siteTitle,
        fieldsFilled: String(filledCount),
      });
    } catch {
      // non-critical
    }
  }

  return NextResponse.json({ matches });
}
