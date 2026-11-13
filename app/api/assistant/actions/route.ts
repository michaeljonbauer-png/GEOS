import { NextRequest, NextResponse } from "next/server";
import { executeAction, WRITE_TOOL_NAMES } from "@/lib/assistant/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Runs an assistant proposal after the user clicks Confirm in the chat.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { type?: string; payload?: Record<string, unknown> };
  if (!body.type || !WRITE_TOOL_NAMES.has(body.type) || !body.payload || typeof body.payload !== "object") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  try {
    return NextResponse.json(await executeAction(body.type, body.payload));
  } catch (err) {
    console.error("Assistant action failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Action failed" }, { status: 500 });
  }
}
