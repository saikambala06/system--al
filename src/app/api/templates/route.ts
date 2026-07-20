import { NextRequest, NextResponse } from "next/server";
import { QuestionTemplate } from "@/db/schema";
import { ensureDB } from "@/db";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const templateSchema = z.object({
  question: z.string().min(1, "Question is required"),
  answer: z.string().min(1, "Answer is required"),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDB();
  const templates = await QuestionTemplate.find({
    userId: session.userId,
  }).sort({ createdAt: 1 });

  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureDB();
    const body = await request.json();
    const parsed = templateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const template = await QuestionTemplate.create({
      userId: session.userId,
      question: data.question,
      answer: data.answer,
      category: data.category ?? "",
      tags: data.tags ?? [],
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("Create template error:", error);
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
        { error: "Template ID required" },
        { status: 400 }
      );
    }

    const parsed = templateSchema.partial().safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const t = parsed.data;
    if (t.question !== undefined) updateData.question = t.question;
    if (t.answer !== undefined) updateData.answer = t.answer;
    if (t.category !== undefined) updateData.category = t.category;
    if (t.tags !== undefined) updateData.tags = t.tags;

    const updated = await QuestionTemplate.findOneAndUpdate(
      { _id: id, userId: session.userId },
      { $set: updateData },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ template: updated });
  } catch (error) {
    console.error("Update template error:", error);
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
      { error: "Template ID required" },
      { status: 400 }
    );
  }

  await QuestionTemplate.deleteOne({ _id: id, userId: session.userId });
  return NextResponse.json({ success: true });
}
