import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { apiTokens } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await db.delete(apiTokens).where(and(eq(apiTokens.id, id), eq(apiTokens.userId, session.userId)));
  return NextResponse.json({ ok: true });
}
