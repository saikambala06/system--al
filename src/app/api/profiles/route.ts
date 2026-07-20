import { NextRequest, NextResponse } from "next/server";
import { Profile } from "@/db/schema";
import { ensureDB } from "@/db";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedin: z.string().optional(),
  website: z.string().optional(),
  resumeText: z.string().optional(),
  fields: z.record(z.string(), z.string()).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDB();
  const userProfiles = await Profile.find({ userId: session.userId }).sort({
    createdAt: 1,
  });

  return NextResponse.json({ profiles: userProfiles });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureDB();
    const body = await request.json();
    const parsed = profileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const profile = await Profile.create({
      userId: session.userId,
      name: data.name,
      email: data.email,
      phone: data.phone ?? "",
      location: data.location ?? "",
      linkedin: data.linkedin ?? "",
      website: data.website ?? "",
      resumeText: data.resumeText ?? "",
      fields: data.fields ?? {},
    });

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    console.error("Create profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureDB();
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Profile ID required" },
        { status: 400 }
      );
    }

    const parsed = profileSchema.partial().safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const p = parsed.data;
    if (p.name !== undefined) updateData.name = p.name;
    if (p.email !== undefined) updateData.email = p.email;
    if (p.phone !== undefined) updateData.phone = p.phone;
    if (p.location !== undefined) updateData.location = p.location;
    if (p.linkedin !== undefined) updateData.linkedin = p.linkedin;
    if (p.website !== undefined) updateData.website = p.website;
    if (p.resumeText !== undefined) updateData.resumeText = p.resumeText;
    if (p.fields !== undefined) updateData.fields = p.fields;

    const updated = await Profile.findOneAndUpdate(
      { _id: id, userId: session.userId },
      { $set: updateData },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ profile: updated });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDB();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Profile ID required" }, { status: 400 });
  }

  await Profile.deleteOne({ _id: id, userId: session.userId });
  return NextResponse.json({ success: true });
}
