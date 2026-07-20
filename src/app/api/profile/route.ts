import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { authenticateExtensionRequest } from "@/lib/apiAuth";

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

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!profile) {
    const [created] = await db.insert(profiles).values({ userId }).returning();
    return NextResponse.json({ profile: created });
  }
  return NextResponse.json({ profile });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const allowedFields = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "address",
    "city",
    "state",
    "zip",
    "country",
    "linkedin",
    "github",
    "portfolio",
    "website",
    "currentTitle",
    "currentCompany",
    "yearsExperience",
    "expectedSalary",
    "noticePeriod",
    "workAuthorization",
    "needsSponsorship",
    "willingToRelocate",
    "gender",
    "veteranStatus",
    "disabilityStatus",
    "race",
    "summary",
    "coverLetter",
    "skills",
    "education",
    "experience",
    "extra",
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key];
  }
  updates.updatedAt = new Date();

  const existing = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, session.userId)).limit(1);
  let profile;
  if (existing.length === 0) {
    [profile] = await db.insert(profiles).values({ userId: session.userId, ...updates }).returning();
  } else {
    [profile] = await db
      .update(profiles)
      .set(updates)
      .where(eq(profiles.userId, session.userId))
      .returning();
  }

  return NextResponse.json({ profile });
}
