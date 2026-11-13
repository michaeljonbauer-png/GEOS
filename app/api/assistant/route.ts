import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ASSISTANT_TOOLS, runAssistantTool } from "@/lib/assistant/tools";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MODEL = process.env.ASSISTANT_MODEL || "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 8;

const SYSTEM = `You are GEOS Assistant, built into GEOS — the operating system a growth equity investor uses to source companies, manage relationships (CRM), run deals, monitor portfolio companies and communicate with LPs.

Answer questions about the user's own GEOS data by calling the tools, which read the live database. Guidelines:
- Every factual statement about companies, contacts, activity, deals or LPs comes from tool results in this conversation. If the data doesn't contain something, say so plainly; never invent companies, people, numbers or dates.
- ARR, growth and headcount figures are often AI estimates from sourcing; flag that when it matters to the answer.
- Link every company or contact you mention using the url from the tool result, e.g. [Acme Works](/companies/abc123) or [Dana Lee](/contacts/xyz789).
- Lead with the answer. Keep it short. Use a markdown table for lists of four or more items, with only the columns that matter; otherwise use bullets or a sentence.
- Status vocabulary: Identified, Reached Out and In Conversation are relationship stages (not on the pipeline); Qualifying, Memo Created, Offer Submitted and In Due Diligence are the pipeline; then Passed and Invested (PortCo). "Pipeline" means those four pipeline stages.
- You can read data but not create or change it. If asked to make a change, say where in GEOS to do it (e.g. the company's page, the Pipeline stage dropdown).
- For general investing questions that don't need the user's data (deal math, market concepts), answer directly.`;

type ChatTurn = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set. Add it in Railway → your service → Variables." }, { status: 500 });
  }
  const body = (await req.json().catch(() => ({}))) as { messages?: ChatTurn[] };
  const history = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20);
  if (!history.length || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "Send a question." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const today = new Date().toISOString().slice(0, 10);
  // Typed loosely: the installed SDK predates thinking and fallback blocks,
  // which must be passed back unchanged within a turn.
  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = history.map((m) => ({ role: m.role, content: m.content }));
  const toolsUsed: string[] = [];

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const response = (await client.messages.create(
        {
          model: MODEL,
          max_tokens: 16000,
          system: [
            { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
            { type: "text", text: `Today is ${today}.` },
          ],
          tools: ASSISTANT_TOOLS,
          messages,
          fallbacks: "default",
        } as unknown as Anthropic.MessageCreateParamsNonStreaming,
        { headers: { "anthropic-beta": "server-side-fallback-2026-07-01" } },
      )) as unknown as { content: Array<{ type: string; [k: string]: unknown }>; stop_reason: string };

      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => String(b.text ?? ""))
        .join("\n")
        .trim();

      if (response.stop_reason === "refusal") {
        return NextResponse.json({ reply: text || "I can't help with that request.", toolsUsed });
      }

      const toolUses = response.content
        .filter((b) => b.type === "tool_use")
        .map((b) => ({ id: String(b.id), name: String(b.name), input: b.input }));
      if (response.stop_reason !== "tool_use" || toolUses.length === 0 || round === MAX_TOOL_ROUNDS) {
        const reply = response.stop_reason === "max_tokens"
          ? `${text}\n\n_(Answer cut off — try a narrower question.)_`
          : text || "I couldn't find an answer to that.";
        return NextResponse.json({ reply, toolsUsed });
      }

      messages.push({ role: "assistant", content: response.content });
      const results = await Promise.all(
        toolUses.map(async (t) => {
          toolsUsed.push(t.name);
          const r = await runAssistantTool(t.name, t.input);
          return { type: "tool_result", tool_use_id: t.id, content: r.content, ...(r.isError && { is_error: true }) };
        }),
      );
      messages.push({ role: "user", content: results });
    }
    return NextResponse.json({ reply: "That took too many lookups — try a more specific question.", toolsUsed });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Rate limit hit — wait a minute and try again." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      const msg = /credit balance/i.test(err.message)
        ? "Anthropic credit balance too low. Add credits at console.anthropic.com."
        : `AI request failed (${err.status ?? "error"}): ${err.message}`;
      return NextResponse.json({ error: msg }, { status: err.status && err.status >= 400 ? err.status : 500 });
    }
    console.error("Assistant error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Assistant failed" }, { status: 500 });
  }
}
