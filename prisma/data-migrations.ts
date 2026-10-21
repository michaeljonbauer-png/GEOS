import { PrismaClient } from "@prisma/client";
import { ensurePrimaryContact } from "../lib/contacts";

const db = new PrismaClient();
const MIGRATION_ID = "2026-10-pipeline-statuses";

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

  // Every company with contacts gets exactly one primary contact.
  const withContacts = await db.company.findMany({ where: { contacts: { some: {} } }, select: { id: true } });
  for (const { id } of withContacts) await ensurePrimaryContact(db, id);

  console.log(
    `[data-migrations] primary contacts checked for ${withContacts.length} companies; ` +
    `meeting scheduled → in conversation: ${meetings.count}; ` +
    `watchlist → identified: ${watchlist.count}; monitoring → invested: ${monitoring.count}; ` +
    (applied ? "identified → qualifying already applied" : `identified → qualifying: ${identified}`)
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
