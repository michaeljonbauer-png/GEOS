import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const task = await db.dealDiligenceTask.update({
    where: { id: params.id },
    data: {
      title: body.title,
      status: body.status,
      priority: body.priority,
      assignee: body.assignee ?? null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      notes: body.notes ?? null,
      workstream: body.workstream,
    },
  });
  return NextResponse.json(task);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await db.dealDiligenceTask.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
