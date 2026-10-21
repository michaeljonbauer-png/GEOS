import type { PrismaClient } from "@prisma/client";

// Every company with contacts has exactly one primary contact. Keeps the
// preferred contact (if given and still at the company), otherwise the
// existing primary, otherwise the longest-standing contact.
export async function ensurePrimaryContact(db: PrismaClient, companyId: string, preferredId?: string) {
  const contacts = await db.contact.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    select: { id: true, isPrimary: true },
  });
  if (contacts.length === 0) return;

  const primaryId =
    (preferredId && contacts.some((c) => c.id === preferredId) && preferredId) ||
    contacts.find((c) => c.isPrimary)?.id ||
    contacts[0].id;

  if (contacts.every((c) => c.isPrimary === (c.id === primaryId))) return;

  await db.$transaction([
    db.contact.updateMany({ where: { companyId, isPrimary: true, id: { not: primaryId } }, data: { isPrimary: false } }),
    db.contact.update({ where: { id: primaryId }, data: { isPrimary: true } }),
  ]);
}
