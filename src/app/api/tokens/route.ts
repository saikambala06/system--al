import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { apiTokens } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { generateApiToken } from "@/lib/tokens";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.userId, session.userId))
    .orderBy(desc(apiTokens.createdAt));

  return NextResponse.json({ tokens: rows });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "Browser Extension").trim();

  const [row] = await db
    .insert(apiTokens)
    .values({ userId: session.userId, token: generateApiToken(), name })
    .returning();

  return NextResponse.json({ token: row });
}
