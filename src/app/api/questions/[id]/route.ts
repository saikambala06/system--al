import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { qaPairs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { normalizeText } from "@/lib/matching";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await request.json();
  const question = String(body.question || "").trim();
  const answer = String(body.answer || "").trim();
  const category = String(body.category || "general").trim();

  if (!question || !answer) {
    return NextResponse.json({ error: "Question and answer are required" }, { status: 400 });
  }

  const [row] = await db
    .update(qaPairs)
    .set({ question, answer, category, questionNormalized: normalizeText(question), updatedAt: new Date() })
    .where(and(eq(qaPairs.id, id), eq(qaPairs.userId, session.userId)))
    .returning();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ question: row });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await db.delete(qaPairs).where(and(eq(qaPairs.id, id), eq(qaPairs.userId, session.userId)));
  return NextResponse.json({ ok: true });
}
