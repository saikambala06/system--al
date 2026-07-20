import { NextRequest, NextResponse } from "next/server";
import { JobApplication } from "@/db/schema";
import { ensureDB } from "@/db";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const applicationSchema = z.object({
  profileId: z.string().optional(),
  jobTitle: z.string().min(1, "Job title is required"),
  company: z.string().optional(),
  jobUrl: z.string().optional(),
  status: z.string().optional(),
  answers: z.record(z.string(), z.string()).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDB();
  const apps = await JobApplication.find({ userId: session.userId }).sort({
    createdAt: 1,
  });

  return NextResponse.json({ applications: apps });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureDB();
    const body = await request.json();
    const parsed = applicationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const app = await JobApplication.create({
      userId: session.userId,
      profileId: data.profileId || undefined,
      jobTitle: data.jobTitle,
      company: data.company ?? "",
      jobUrl: data.jobUrl ?? "",
      status: data.status ?? "pending",
      answers: data.answers ?? {},
    });

    return NextResponse.json({ application: app }, { status: 201 });
  } catch (error) {
    console.error("Create application error:", error);
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
        { error: "Application ID required" },
        { status: 400 }
      );
    }

    const parsed = applicationSchema.partial().safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const p = parsed.data;
    if (p.profileId !== undefined) updateData.profileId = p.profileId;
    if (p.jobTitle !== undefined) updateData.jobTitle = p.jobTitle;
    if (p.company !== undefined) updateData.company = p.company;
    if (p.jobUrl !== undefined) updateData.jobUrl = p.jobUrl;
    if (p.status !== undefined) updateData.status = p.status;
    if (p.answers !== undefined) updateData.answers = p.answers;

    const updated = await JobApplication.findOneAndUpdate(
      { _id: id, userId: session.userId },
      { $set: updateData },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ application: updated });
  } catch (error) {
    console.error("Update application error:", error);
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
    return NextResponse.json(
      { error: "Application ID required" },
      { status: 400 }
    );
  }

  await JobApplication.deleteOne({ _id: id, userId: session.userId });
  return NextResponse.json({ success: true });
}
