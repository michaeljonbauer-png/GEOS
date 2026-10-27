import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEFAULT_CONTACT_TYPES } from "@/lib/utils";

export const dynamic = "force-dynamic";

// All contact-type options: the defaults plus any tag in use, with counts.
export async function GET() {
  try {
    const rows = await db.contact.findMany({ select: { contactTypes: true } });
    const counts = new Map<string, { label: string; count: number }>();
    for (const label of DEFAULT_CONTACT_TYPES) counts.set(label.toLowerCase(), { label, count: 0 });
    for (const { contactTypes } of rows) {
      for (const t of contactTypes) {
        const key = t.toLowerCase();
        const entry = counts.get(key) ?? { label: t, count: 0 };
        entry.count++;
        counts.set(key, entry);
      }
    }
    const defaultsOrder = DEFAULT_CONTACT_TYPES.map((t) => t.toLowerCase());
    const options = Array.from(counts.values()).sort((a, b) => {
      const ai = defaultsOrder.indexOf(a.label.toLowerCase());
      const bi = defaultsOrder.indexOf(b.label.toLowerCase());
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a.label.localeCompare(b.label);
    });
    return NextResponse.json(options);
  } catch (error) {
    console.error(error);
    return NextResponse.json(DEFAULT_CONTACT_TYPES.map((label) => ({ label, count: 0 })));
  }
}
