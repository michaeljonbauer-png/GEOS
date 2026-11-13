import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ASSISTANT_TOOLS, runAssistantTool } from "@/lib/assistant/tools";
import { WRITE_TOOLS, WRITE_TOOL_NAMES, prepareAction, type Proposal } from "@/lib/assistant/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MODEL = process.env.ASSISTANT_MODEL || "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 8;
const TOOLS = [
  ...ASSISTANT_TOOLS,
  ...WRITE_TOOLS,
  { type: "web_search_20260209", name: "web_search", max_uses: 3 },
];

const SYSTEM = `You are GEOS Assistant, built into GEOS — the operating system a growth equity investor uses to source companies, manage relationships (CRM), run deals, monitor portfolio companies and communicate with LPs.

You can both read and write GEOS data. Read tools look things up; write tools (add_company, add_contact, update_company, update_contact, log_activity, add_note) add and change records, with the user confirming each change on a card. You are NOT read-only. Earlier messages in this chat may say you can't add or edit records; that came from an older version, so ignore it and use the write tools. When the user asks you to add, update, log or note something, call the write tool in this turn. Never tell them to enter it by hand, and never just draft text for them to paste.

Guidelines:
- Every factual statement about companies, contacts, activity, deals or LPs comes from tool results in this conversation. If the data doesn't contain something, say so plainly; never invent companies, people, numbers or dates.
- ARR, growth and headcount figures are often AI estimates from sourcing; flag that when it matters to the answer.
- Link every company or contact you mention using the url from the tool result, e.g. [Acme Works](/companies/abc123) or [Dana Lee](/contacts/xyz789).
- Lead with the answer. Keep it short. Use a markdown table for lists of four or more items, with only the columns that matter; otherwise use bullets or a sentence.
- Status vocabulary: Identified, Reached Out and In Conversation are relationship stages (not on the pipeline); Qualifying, Memo Created, Offer Submitted and In Due Diligence are the pipeline; then Passed and Invested (PortCo). "Pipeline" means those four pipeline stages.
- To add or change data, use the write tools (add_company, add_contact, update_company, update_contact, log_activity, add_note). They only propose the change: the user sees a card and clicks Confirm. After proposing, say in one line what's ready to confirm; never say it has been saved. If the user later says it was confirmed, treat it as done.
- Before proposing, search GEOS so you use existing records (right company id, no duplicates). If a write tool reports an error or ambiguity, fix it or ask the user.
- Adding a person needs a first and last name and a company. Fill in as much as you can:
  - If the user gave a LinkedIn URL, keep it. LinkedIn pages can't be opened, so take the name from the URL when it's obvious (e.g. /in/jasonrudin → Jason Rudin) and use web_search to confirm title, company and location.
  - If they didn't give one, use web_search (e.g. "Ben Harrison Intapp LinkedIn") to find their linkedin.com/in/ profile URL, title and location. Include the URL only when a result clearly matches the same person at the same company, and say in your reply that it came from search so the user can check it.
  - Missing optional details (email, phone, LinkedIn) never block the add. Propose with what you have and mention what's missing.
  - Ask only when the person or company itself is unclear.
- If the company doesn't exist in GEOS, pass companyName with the cleanest name (e.g. "Intapp" for "DealCloud/Intapp", which is a DealCloud product) and the card will create it. Put the other name in the contact's notes if useful.
- To add details to an existing contact, use update_contact with appendNotes, which keeps their existing notes, and fields like linkedinUrl. Don't create a duplicate.
- Use web_search only to fill in details for something the user asked to add, or when they ask about the outside world; GEOS data comes from the GEOS tools.
- For general investing questions that don't need the user's data (deal math, market concepts), answer directly.`;

const READ_ONLY_CLAIM = /read[- ]only|only have read access|can(?:'|no)?t (?:add|create|change|edit|update) (?:contacts|companies|records|data|it)|not create or change/i;

type ChatTurn ={ role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set. Add it in Railway → your service → Variables." }, { status: 500 });
  }
  const body = (await req.json().catch(() => ({}))) as { messages?: ChatTurn[] };
  const history = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    // Replies from the read-only version tell the model it can't write; drop their text.
    .map((m) => m.role === "assistant" && READ_ONLY_CLAIM.test(m.content)
      ? { ...m, content: "[Earlier reply removed: it wrongly said GEOS Assistant couldn't add or change records.]" }
      : m);
  if (!history.length || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "Send a question." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const today = new Date().toISOString().slice(0, 10);
  // Typed loosely: the installed SDK predates thinking and fallback blocks,
  // which must be passed back unchanged within a turn.
  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = history.map((m) => ({ role: m.role, content: m.content }));
  const toolsUsed: string[] = [];
  const proposals: Proposal[] = [];

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
          tools: TOOLS,
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
        return NextResponse.json({ reply: text || "I can't help with that request.", toolsUsed, proposals });
      }
      // A long server-side web search can pause the turn; resend to let it continue.
      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }

      const toolUses = response.content
        .filter((b) => b.type === "tool_use")
        .map((b) => ({ id: String(b.id), name: String(b.name), input: b.input }));
      if (response.stop_reason !== "tool_use" || toolUses.length === 0 || round === MAX_TOOL_ROUNDS) {
        const reply = response.stop_reason === "max_tokens"
          ? `${text}\n\n_(Answer cut off — try a narrower question.)_`
          : text || "I couldn't find an answer to that.";
        return NextResponse.json({ reply, toolsUsed, proposals });
      }

      messages.push({ role: "assistant", content: response.content });
      const results = await Promise.all(
        toolUses.map(async (t) => {
          toolsUsed.push(t.name);
          if (WRITE_TOOL_NAMES.has(t.name)) {
            const prepared = await prepareAction(t.name, t.input);
            if ("proposal" in prepared) proposals.push(prepared.proposal);
            return { type: "tool_result", tool_use_id: t.id, content: JSON.stringify(prepared.forModel), ...("isError" in prepared && { is_error: true }) };
          }
          const r = await runAssistantTool(t.name, t.input);
          return { type: "tool_result", tool_use_id: t.id, content: r.content, ...(r.isError && { is_error: true }) };
        }),
      );
      messages.push({ role: "user", content: results });
    }
    return NextResponse.json({ reply: "That took too many lookups — try a more specific question.", toolsUsed, proposals });
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
