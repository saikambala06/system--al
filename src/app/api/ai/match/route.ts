import { NextRequest, NextResponse } from "next/server";
import { QuestionTemplate } from "@/db/schema";
import { ensureDB } from "@/db";
import { matchQuestion } from "@/lib/ai-matcher";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const matchSchema = z.object({
  question: z.string().min(1),
});

const batchMatchSchema = z.object({
  questions: z.array(z.string()).min(1),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureDB();
    const body = await request.json();

    // Check if it's a batch request
    if (batchMatchSchema.safeParse(body).success) {
      const { questions } = body as { questions: string[] };

      const templates = await QuestionTemplate.find({
        userId: session.userId,
      });

      const templateList = templates.map((t) => ({
        id: t._id.toString(),
        question: t.question,
        answer: t.answer,
      }));

      const results: Record<
        string,
        {
          matched: boolean;
          confidence: number;
          suggestedAnswer?: string;
          matchedTemplateId?: string;
        }
      > = {};

      for (const question of questions) {
        results[question] = await matchQuestion(question, templateList);
      }

      return NextResponse.json({ results });
    }

    // Single question match
    const parsed = matchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    const { question } = parsed.data;

    const templates = await QuestionTemplate.find({
      userId: session.userId,
    });

    const templateList = templates.map((t) => ({
      id: t._id.toString(),
      question: t.question,
      answer: t.answer,
    }));

    const result = await matchQuestion(question, templateList);

    return NextResponse.json({ result });
  } catch (error) {
    console.error("AI match error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
