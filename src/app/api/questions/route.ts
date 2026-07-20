import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { qaPairs } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { authenticateExtensionRequest } from "@/lib/apiAuth";
import { normalizeText } from "@/lib/matching";

async function resolveUserId(request: NextRequest) {
  const session = await getSession();
  if (session) return session.userId;
  const ext = await authenticateExtensionRequest(request);
  if (ext) return ext.userId;
  return null;
}

export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(qaPairs)
    .where(eq(qaPairs.userId, userId))
    .orderBy(desc(qaPairs.updatedAt));

  return NextResponse.json({ questions: rows });
}

export async function POST(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const question = String(body.question || "").trim();
  const answer = String(body.answer || "").trim();
  const category = String(body.category || "general").trim();
  const source = String(body.source || "manual").trim();

  if (!question || !answer) {
    return NextResponse.json({ error: "Question and answer are required" }, { status: 400 });
  }

  const normalized = normalizeText(question);

  const existing = await db
    .select()
    .from(qaPairs)
    .where(and(eq(qaPairs.userId, userId), eq(qaPairs.questionNormalized, normalized)))
    .limit(1);

  let row;
  if (existing.length > 0) {
    [row] = await db
      .update(qaPairs)
      .set({ answer, category, updatedAt: new Date() })
      .where(eq(qaPairs.id, existing[0].id))
      .returning();
  } else {
    [row] = await db
      .insert(qaPairs)
      .values({ userId, question, questionNormalized: normalized, answer, category, source })
      .returning();
  }

  return NextResponse.json({ question: row });
}
