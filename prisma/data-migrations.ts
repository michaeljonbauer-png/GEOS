import { PrismaClient } from "@prisma/client";
import { ensurePrimaryContact } from "../lib/contacts";
import { normalizeUrl } from "../lib/urls";

const db = new PrismaClient();
const MIGRATION_ID = "2026-10-pipeline-statuses";
const GUESSED_LINKEDIN_ID = "2026-10-clear-hunt-guessed-linkedin";
const TWO_MINUTES = 2 * 60 * 1000;

async function main() {
  // Retired statuses folded into their replacements; safe to repeat.
  const meetings = await db.company.updateMany({
    where: { status: "MEETING_SCHEDULED" },
    data: { status: "IN_CONVERSATION" },
  });
  const watchlist = await db.company.updateMany({
    where: { status: "WATCHLIST" },
    data: { status: "IDENTIFIED" },
  });
  const monitoring = await db.company.updateMany({
    where: { status: "MONITORING" },
    data: { status: "INVESTED" },
  });
  // "Bank" company type was retired; Bank Lender is the closest remaining type.
  const banks = await db.company.updateMany({
    where: { companyType: "BANK" },
    data: { companyType: "BANK_LENDER" },
  });

  // Identified is no longer a pipeline stage. Companies that were sitting in
  // it on the pipeline move to Qualifying — once only, so companies marked
  // Identified afterwards stay in the Companies list.
  const applied = await db.appMigration.findUnique({ where: { id: MIGRATION_ID } });
  let identified = 0;
  if (!applied) {
    const [moved] = await db.$transaction([
      db.company.updateMany({
        where: { status: "IDENTIFIED", companyType: "OPERATING_COMPANY" },
        data: { status: "QUALIFYING" },
      }),
      db.appMigration.create({ data: { id: MIGRATION_ID } }),
    ]);
    identified = moved.count;
  }

  // Hunt used to fill founder LinkedIn URLs from model memory (no web
  // access), so they were guesses that often 404'd. Once only, clear those
  // on founder contacts Hunt auto-created and nobody has edited since.
  let clearedGuesses = 0;
  if (!(await db.appMigration.findUnique({ where: { id: GUESSED_LINKEDIN_ID } }))) {
    const candidates = await db.contact.findMany({
      where: {
        linkedinUrl: { not: null },
        company: { OR: [{ source: { startsWith: "Hunt:" } }, { source: { contains: "Training knowledge" } }] },
      },
      select: { id: true, createdAt: true, updatedAt: true, company: { select: { createdAt: true } } },
    });
    const guessed = candidates
      .filter((c) =>
        Math.abs(c.createdAt.getTime() - c.company.createdAt.getTime()) < TWO_MINUTES &&
        c.updatedAt.getTime() - c.createdAt.getTime() < TWO_MINUTES
      )
      .map((c) => c.id);
    await db.$transaction([
      db.contact.updateMany({ where: { id: { in: guessed } }, data: { linkedinUrl: null } }),
      db.appMigration.create({ data: { id: GUESSED_LINKEDIN_ID } }),
    ]);
    clearedGuesses = guessed.length;
  }

  // Stored links get a scheme and lose tracking params; safe to repeat.
  let normalizedLinks = 0;
  const contactLinks = await db.contact.findMany({ where: { linkedinUrl: { not: null } }, select: { id: true, linkedinUrl: true } });
  for (const c of contactLinks) {
    const fixed = normalizeUrl(c.linkedinUrl);
    if (fixed !== c.linkedinUrl) { await db.contact.update({ where: { id: c.id }, data: { linkedinUrl: fixed } }); normalizedLinks++; }
  }
  const companyLinks = await db.company.findMany({
    where: { OR: [{ website: { not: null } }, { linkedinUrl: { not: null } }, { crunchbaseUrl: { not: null } }] },
    select: { id: true, website: true, linkedinUrl: true, crunchbaseUrl: true },
  });
  for (const c of companyLinks) {
    const fixed = { website: normalizeUrl(c.website), linkedinUrl: normalizeUrl(c.linkedinUrl), crunchbaseUrl: normalizeUrl(c.crunchbaseUrl) };
    if (fixed.website !== c.website || fixed.linkedinUrl !== c.linkedinUrl || fixed.crunchbaseUrl !== c.crunchbaseUrl) {
      await db.company.update({ where: { id: c.id }, data: fixed });
      normalizedLinks++;
    }
  }

  // Every company with contacts gets exactly one primary contact.
  const withContacts = await db.company.findMany({ where: { contacts: { some: {} } }, select: { id: true } });
  for (const { id } of withContacts) await ensurePrimaryContact(db, id);

  console.log(
    `[data-migrations] primary contacts checked for ${withContacts.length} companies; ` +
    `meeting scheduled → in conversation: ${meetings.count}; ` +
    `watchlist → identified: ${watchlist.count}; monitoring → invested: ${monitoring.count}; ` +
    `bank → bank lender: ${banks.count}; ` +
    `guessed founder LinkedIn links cleared: ${clearedGuesses}; links normalized: ${normalizedLinks}; ` +
    (applied ? "identified → qualifying already applied" : `identified → qualifying: ${identified}`)
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
