import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getPapersCleanCollection } from "../../../../lib/mongodb-user-interactions";

export const runtime = "nodejs";

function parseStructuredResponse(outputText: string) {
	try {

		let cleaned = outputText.trim();

		cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '');

		cleaned = cleaned.trim();

		const parsed = JSON.parse(cleaned);
		return {
			aiSummary: typeof parsed.AI_Summary === "string" ? parsed.AI_Summary : "",
		};
	} catch (e) {
		console.error("/api/ai/summarize: Failed to parse structured response", {
			error: e,
			outputLength: outputText.length,
			outputPreview: outputText.slice(0, 200)
		});
		return null;
	}
}

export async function POST(req: NextRequest) {
	const isProd = process.env.NODE_ENV === "production";
	const t0 = Date.now();
	try {
		let body: any = {};
		try {
			body = await req.json();
		} catch (e) {
			console.error("/api/ai/summarize: Failed to parse JSON body", e);
			return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
		}

		const { title, abstract, model = "gpt-4o", paperId } = body || {};

		console.log("/api/ai/summarize: request", {
			model,
			titleLen: typeof title === "string" ? title.length : null,
			abstractLen: typeof abstract === "string" ? abstract.length : null,
			paperId: paperId || 'not provided',
			hasKey: !!process.env.OPENAI_API_KEY,
		});

		if (!process.env.OPENAI_API_KEY) {
			return NextResponse.json(
				{ error: "Server missing OPENAI_API_KEY. Set it in environment variables." },
				{ status: 500 }
			);
		}

		if (!title || !abstract) {
			return NextResponse.json(
				{ error: "Missing required fields: title and abstract" },
				{ status: 400 }
			);
		}

		// CHECK FOR CACHED SUMMARY IN DATABASE
		if (paperId) {
			try {
				const papersCollection = await getPapersCleanCollection();
				const paper = await papersCollection.findOne(
					{ _id: paperId },
					{ projection: { ai_summary: 1 } }
				);

				if (paper && paper.ai_summary) {
					console.log("/api/ai/summarize: Found cached summary", {
						paperId,
						summaryLength: paper.ai_summary.length,
						elapsedMs: Date.now() - t0,
					});

					return NextResponse.json({
						summaryText: `{"AI_Summary": "${paper.ai_summary}"}`,
						aiSummary: paper.ai_summary,
						modelUsed: model,
						elapsedMs: Date.now() - t0,
						structured: true,
						cached: true,
					});
				}

				console.log("/api/ai/summarize: No cached summary found, generating new summary", {
					paperId,
				});
			} catch (err: any) {
				console.error("/api/ai/summarize: Error checking for cached summary", {
					error: err?.message,
					paperId,
				});
				// Continue to generate new summary if cache check fails
			}
		} else {
			console.log("/api/ai/summarize: No paperId provided, skipping cache check");
		}

		const trimmedAbstract = String(abstract).slice(0, 6000);
		const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

		const prompt = `You are a world-class scientific communicator writing headline-style, single- or multi-sentence summaries of neuroscience research abstracts for the VergeSci platform. Your summary must be:
• No longer than 50 words
• Scientifically accurate
• Written in clear, active language
• Tailored to researchers and advanced students
• Based only on information in the abstract
• Faithful to the background, method, findings, and significance of the study, namely all those that are present

Focus on capturing the core message of the abstract, including (if present):
• The scientific context or background (why this work matters)
• The central method or innovation (what was done or tested)
• The main findings or result (what was discovered or observed)
• The implication or conclusion (why it's important to the field)

Use formal tone, precise language, and avoid exaggeration. No questions, no filler, no assumptions not grounded in the abstract. If findings are negative or uncertain, clearly state so. Avoid buzzwords unless used by the authors themselves. DO NOT HALLUCINATE; ACCURATE INFORMATION, PULLED EXCLUSIVELY FROM THE ABSTRACT, IS OF THE UTMOST IMPORTANCE.

Title: ${title}

Abstract: ${trimmedAbstract}

Return exactly this JSON structure:
{
  "AI_Summary": "[50-word or less max headline-style summary]"
}

Your goal is to foster more collaboration within neuroscience and drive discovery. If you fail, you will be exiled from the research community. If you succeed, your work will bring the field together and you will win the Nobel Prize. Precision and integrity are non-negotiable.`;

		let response: any;
		try {
			response = await client.chat.completions.create({
				model,
				messages: [
					{ role: "system", content: "You are an expert neuroscientist. Return only valid JSON, no additional text." },
					{ role: "user", content: prompt },
				],
				temperature: 0.3,
			});
			console.log("/api/ai/summarize: OpenAI call ok", {
				elapsedMs: Date.now() - t0,
				usage: response?.usage,
			});
		} catch (err: any) {
			console.error("/api/ai/summarize: OpenAI call failed", {
				elapsedMs: Date.now() - t0,
				message: err?.message,
				status: err?.status,
				code: err?.code,
				detail: err?.response || err?.data || undefined,
			});
			return NextResponse.json(
				{
					error: isProd ? "Failed to summarize" : `OpenAI error: ${err?.message || "unknown"}`,
					status: err?.status || 500,
					code: err?.code || undefined,
				},
				{ status: 502 }
			);
		}

		const outputText = response?.choices?.[0]?.message?.content?.trim();
		if (!outputText) {
			console.error("/api/ai/summarize: No text returned from model", {
				elapsedMs: Date.now() - t0,
			});
			return NextResponse.json(
				{ error: "No text returned from model" },
				{ status: 502 }
			);
		}

		// Try to parse structured response
		const structured = parseStructuredResponse(outputText);
		let aiSummary = "";

		if (structured) {
			aiSummary = structured.aiSummary;
			console.log("/api/ai/summarize: success (structured)", {
				elapsedMs: Date.now() - t0,
				summaryLength: aiSummary.length,
			});
		} else {
			// Fallback: try to extract summary from raw text
			aiSummary = outputText.slice(0, 200).trim();
			console.log("/api/ai/summarize: success (fallback)", {
				elapsedMs: Date.now() - t0,
				summaryLength: aiSummary.length,
			});
		}

		// SAVE SUMMARY TO DATABASE
		if (paperId && aiSummary) {
			try {
				const papersCollection = await getPapersCleanCollection();
				const updateResult = await papersCollection.updateOne(
					{ _id: paperId },
					{
						$set: {
							ai_summary: aiSummary,
							ai_summary_generated_at: new Date(),
						},
					}
				);

				if (updateResult.matchedCount > 0) {
					console.log("/api/ai/summarize: Successfully saved summary to database", {
						paperId,
						modified: updateResult.modifiedCount > 0,
					});
				} else {
					console.warn("/api/ai/summarize: Paper not found in database, could not save summary", {
						paperId,
					});
				}
			} catch (err: any) {
				console.error("/api/ai/summarize: Error saving summary to database", {
					error: err?.message,
					paperId,
				});
				// Don't fail the request if we can't save to cache
			}
		}

		return NextResponse.json({
			summaryText: outputText,
			aiSummary: aiSummary,
			modelUsed: model,
			elapsedMs: Date.now() - t0,
			structured: !!structured,
			cached: false,
		});
	} catch (err: any) {
		console.error("/api/ai/summarize: unexpected error", err);
		return NextResponse.json(
			{ error: isProd ? "Failed to summarize" : err?.message || "Failed to summarize" },
			{ status: 500 }
		);
	}
}
