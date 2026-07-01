import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// IDs that were inserted by prisma/seed.ts — safe to delete on every deploy.
// Real user data uses cuid() IDs and will never match these prefixed IDs.

const SEED_COMPANY_IDS = [
  "co_revel_systems",
  "co_axiom_data",
  "co_pathlight",
  "co_secureframe",
  "co_anrok",
  "co_watershed",
  "co_leapsome",
  "co_stytch",
  "co_fieldwork_ai",
  "co_clearpath_compliance",
];

async function main() {
  console.log("🧹 Removing demo seed data...");

  // Delete dependents before parents to respect FK constraints.
  const kpi = await db.portfolioKPISnapshot.deleteMany({ where: { companyId: { in: SEED_COMPANY_IDS } } });
  console.log(`  ✓ ${kpi.count} KPI snapshots removed`);

  const inv = await db.portfolioInvestment.deleteMany({ where: { companyId: { in: SEED_COMPANY_IDS } } });
  console.log(`  ✓ ${inv.count} investment records removed`);

  const interactions = await db.interaction.deleteMany({ where: { companyId: { in: SEED_COMPANY_IDS } } });
  console.log(`  ✓ ${interactions.count} interactions removed`);

  const notes = await db.note.deleteMany({ where: { companyId: { in: SEED_COMPANY_IDS } } });
  console.log(`  ✓ ${notes.count} notes removed`);

  const scores = await db.scoreDetail.deleteMany({ where: { companyId: { in: SEED_COMPANY_IDS } } });
  console.log(`  ✓ ${scores.count} score details removed`);

  const contacts = await db.contact.deleteMany({ where: { companyId: { in: SEED_COMPANY_IDS } } });
  console.log(`  ✓ ${contacts.count} contacts removed`);

  // companyFeedback may exist if AI sourcing touched these companies
  try {
    const feedback = await db.companyFeedback.deleteMany({ where: { companyId: { in: SEED_COMPANY_IDS } } });
    console.log(`  ✓ ${feedback.count} feedback records removed`);
  } catch { /* table may not exist yet */ }

  const companies = await db.company.deleteMany({ where: { id: { in: SEED_COMPANY_IDS } } });
  console.log(`  ✓ ${companies.count} companies removed`);

  const lps = await db.lPContact.deleteMany({
    where: { id: { in: ["lp_family_office_1", "lp_endowment_1", "lp_coinvestor_1"] } },
  });
  console.log(`  ✓ ${lps.count} LP contacts removed`);

  console.log("✅ Demo data cleared.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
