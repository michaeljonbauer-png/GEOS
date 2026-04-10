import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });
  const tasks = await db.dealDiligenceTask.findMany({
    where: { companyId },
    orderBy: [{ workstream: "asc" }, { order: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { companyId, title, workstream, priority, assignee, dueDate, notes } = body;
  if (!companyId || !title || !workstream) return NextResponse.json({ error: "companyId, title, workstream required" }, { status: 400 });
  const task = await db.dealDiligenceTask.create({
    data: { companyId, title, workstream, priority: priority ?? "MEDIUM", assignee: assignee ?? null, dueDate: dueDate ? new Date(dueDate) : null, notes: notes ?? null },
  });
  return NextResponse.json(task);
}
