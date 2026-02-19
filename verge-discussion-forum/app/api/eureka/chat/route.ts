import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { EUREKA_CHAT_SYSTEM_PROMPT, FORMAT_INSTRUCTIONS } from "../../../eureka/chatPrompt";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const { query } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required and must be a string" },
        { status: 400 }
      );
    }

    const model = process.env.GPT_MODEL || "gpt-5-nano";
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const userMessage = `${query}\n\n${FORMAT_INSTRUCTIONS}`;

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: EUREKA_CHAT_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      ...(model.toLowerCase().includes("gpt-5")
        ? {}
        : {
            temperature: 0.7,
            max_tokens: 1500,
          }),
    });

    const answer = completion.choices?.[0]?.message?.content;

    if (!answer) {
      throw new Error("OpenAI returned an empty response");
    }

    return NextResponse.json({
      query,
      answer,
      papers: [],
      metadata: {
        mode: "chat",
        num_papers: 0,
        model,
      },
    });
  } catch (error: any) {
    console.error("Eureka Chat API error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

