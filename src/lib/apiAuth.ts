import { NextRequest } from "next/server";
import { db } from "@/db";
import { apiTokens } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function authenticateExtensionRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return null;

  const [row] = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.token, token))
    .limit(1);

  if (!row || !row.isActive) return null;

  db.update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, row.id))
    .then(() => {})
    .catch(() => {});

  return { userId: row.userId, tokenId: row.id };
}
