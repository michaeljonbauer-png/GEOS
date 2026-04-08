import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // --- Investment Criteria ---
  const criteriaData = [
    { name: "Revenue Scale (ARR)", description: "Current ARR size and trajectory relative to stage", weight: 0.15, minThreshold: 5, order: 1 },
    { name: "Revenue Growth", description: "YoY ARR growth rate vs. peer benchmarks", weight: 0.20, minThreshold: 6, order: 2 },
    { name: "Net Revenue Retention", description: "NRR/NDR — expansion revenue and churn signal", weight: 0.15, minThreshold: 6, order: 3 },
    { name: "Gross Margin", description: "Unit economics and long-term scalability potential", weight: 0.10, minThreshold: 5, order: 4 },
    { name: "Market Size (TAM)", description: "Total addressable market opportunity and expansion vectors", weight: 0.15, minThreshold: 6, order: 5 },
    { name: "Competitive Moat", description: "Defensibility, switching costs, network effects, IP", weight: 0.10, minThreshold: 5, order: 6 },
    { name: "Team Quality", description: "Founder-market fit, track record, functional depth", weight: 0.10, minThreshold: 6, order: 7 },
    { name: "Go-to-Market Efficiency", description: "Sales motion efficiency, CAC payback, GTM repeatability", weight: 0.05, minThreshold: 4, order: 8 },
  ];

  const criteria = await Promise.all(
    criteriaData.map((c) =>
      db.criterion.upsert({
        where: { id: `criterion_${c.order}` },
        update: {},
        create: { id: `criterion_${c.order}`, ...c },
      })
    )
  );
  console.log(`  ✓ ${criteria.length} investment criteria`);

  // --- Companies ---
  const companiesData = [
    {
      name: "Revel Systems",
      website: "https://revelsystems.com",
      description: "Cloud-based POS platform for enterprise restaurants and retail chains. Strong vertical focus with deep integrations.",
      sector: "B2B SaaS",
      subSector: "Hospitality Tech",
      geography: "San Francisco, CA",
      arrEstimate: 45,
      arrGrowth: 85,
      nrrEstimate: 118,
      grossMargin: 72,
      employees: 320,
      founded: 2010,
      stage: "Growth",
      status: "IN_CONVERSATION",
      priority: "HIGH",
      source: "LinkedIn",
    },
    {
      name: "Axiom Data",
      website: "https://axiomdata.io",
      description: "Real-time data pipeline and observability platform for modern data teams. Competing with Fivetran in mid-market.",
      sector: "Data & Analytics",
      subSector: "Data Engineering",
      geography: "New York, NY",
      arrEstimate: 12,
      arrGrowth: 145,
      nrrEstimate: 124,
      grossMargin: 78,
      employees: 75,
      founded: 2020,
      stage: "Series B",
      status: "MEETING_SCHEDULED",
      priority: "HIGH",
      source: "Conference — Data Council",
    },
    {
      name: "Pathlight",
      website: "https://pathlight.com",
      description: "Performance management platform for revenue teams. Helps CS and sales leaders coach reps using real-time data.",
      sector: "HR Tech",
      subSector: "Revenue Performance",
      geography: "San Francisco, CA",
      arrEstimate: 8,
      arrGrowth: 110,
      nrrEstimate: 115,
      grossMargin: 75,
      employees: 55,
      founded: 2018,
      stage: "Series A",
      status: "REACHED_OUT",
      priority: "MEDIUM",
      source: "Referral — Andreessen Horowitz",
    },
    {
      name: "Secureframe",
      website: "https://secureframe.com",
      description: "Compliance automation platform for SOC 2, ISO 27001, HIPAA. Strong product-led growth motion.",
      sector: "CyberSecurity",
      subSector: "Compliance Automation",
      geography: "San Francisco, CA",
      arrEstimate: 25,
      arrGrowth: 130,
      nrrEstimate: 120,
      grossMargin: 80,
      employees: 140,
      founded: 2019,
      stage: "Series B",
      status: "QUALIFYING",
      priority: "HIGH",
      source: "LinkedIn research",
    },
    {
      name: "Anrok",
      website: "https://anrok.com",
      description: "Sales tax compliance for SaaS companies. Automatically calculates, collects, and remits sales tax.",
      sector: "FinTech",
      subSector: "Tax Compliance",
      geography: "San Francisco, CA",
      arrEstimate: 5,
      arrGrowth: 200,
      nrrEstimate: 130,
      grossMargin: 82,
      employees: 35,
      founded: 2021,
      stage: "Series A",
      status: "IDENTIFIED",
      priority: "MEDIUM",
      source: "Newsletter — SaaS Weekly",
    },
    {
      name: "Watershed",
      website: "https://watershed.com",
      description: "Enterprise carbon accounting and sustainability management platform. Momentum with Fortune 500.",
      sector: "B2B SaaS",
      subSector: "ESG/Climate Tech",
      geography: "San Francisco, CA",
      arrEstimate: 18,
      arrGrowth: 90,
      nrrEstimate: 112,
      grossMargin: 74,
      employees: 120,
      founded: 2019,
      stage: "Series B",
      status: "IDENTIFYING",
      priority: "LOW",
      source: "TechCrunch article",
    },
    {
      name: "Leapsome",
      website: "https://leapsome.com",
      description: "People enablement platform combining performance management, OKRs, engagement surveys, and L&D.",
      sector: "HR Tech",
      subSector: "People Management",
      geography: "New York, NY / Berlin",
      arrEstimate: 22,
      arrGrowth: 75,
      nrrEstimate: 116,
      grossMargin: 76,
      employees: 180,
      founded: 2016,
      stage: "Series A",
      status: "DUE_DILIGENCE",
      priority: "HIGH",
      source: "Inbound — requested intro",
    },
    {
      name: "Stytch",
      website: "https://stytch.com",
      description: "Developer authentication platform with passkeys, magic links, and session management. API-first.",
      sector: "DevTools",
      subSector: "Auth & Identity",
      geography: "San Francisco, CA",
      arrEstimate: 9,
      arrGrowth: 160,
      nrrEstimate: 122,
      grossMargin: 79,
      employees: 60,
      founded: 2020,
      stage: "Series B",
      status: "QUALIFYING",
      priority: "MEDIUM",
      source: "Twitter / X",
    },
  ];

  const companies: { id: string; name: string }[] = [];
  for (const data of companiesData) {
    const company = await db.company.upsert({
      where: { id: `co_${data.name.toLowerCase().replace(/\s+/g, "_")}` },
      update: {},
      create: {
        id: `co_${data.name.toLowerCase().replace(/\s+/g, "_")}`,
        ...data,
      },
    });
    companies.push(company);
  }
  console.log(`  ✓ ${companies.length} companies`);

  // --- Contacts ---
  const contactsData = [
    { firstName: "Sarah", lastName: "Chen", title: "CEO & Co-founder", email: "sarah@revelsystems.com", linkedinUrl: "https://linkedin.com/in/sarahchen", isPrimary: true, companyId: `co_revel_systems` },
    { firstName: "Marcus", lastName: "Kim", title: "CFO", email: "marcus@revelsystems.com", linkedinUrl: "https://linkedin.com/in/marcuskim", isPrimary: false, companyId: `co_revel_systems` },
    { firstName: "David", lastName: "Park", title: "CEO", email: "david@axiomdata.io", linkedinUrl: "https://linkedin.com/in/davidpark", isPrimary: true, companyId: `co_axiom_data` },
    { firstName: "Jennifer", lastName: "Wu", title: "CTO", email: "jennifer@pathlight.com", linkedinUrl: "", isPrimary: true, companyId: `co_pathlight` },
    { firstName: "Sam", lastName: "Aarons", title: "CEO & Co-founder", email: "sam@secureframe.com", linkedinUrl: "https://linkedin.com/in/samaarons", isPrimary: true, companyId: `co_secureframe` },
    { firstName: "Jessica", lastName: "Zhang", title: "CEO", email: "jessica@anrok.com", linkedinUrl: "https://linkedin.com/in/jessicazhang", isPrimary: true, companyId: `co_anrok` },
    { firstName: "Christian", lastName: "Muller", title: "CEO & Co-founder", email: "christian@leapsome.com", linkedinUrl: "https://linkedin.com/in/christianmuller", isPrimary: true, companyId: `co_leapsome` },
    { firstName: "Reed", lastName: "McGinley-Stempel", title: "CEO", email: "reed@stytch.com", linkedinUrl: "https://linkedin.com/in/reedmcginley", isPrimary: true, companyId: `co_stytch` },
  ];

  for (const c of contactsData) {
    await db.contact.upsert({
      where: { id: `contact_${c.firstName.toLowerCase()}_${c.companyId}` },
      update: {},
      create: {
        id: `contact_${c.firstName.toLowerCase()}_${c.companyId}`,
        ...c,
      },
    });
  }
  console.log(`  ✓ ${contactsData.length} contacts`);

  // --- Score some companies ---
  const scoreMap: Record<string, number[]> = {
    co_revel_systems: [7, 8, 8, 7, 7, 8, 8, 7],
    co_axiom_data: [6, 9, 8, 8, 8, 7, 8, 8],
    co_leapsome: [7, 7, 8, 7, 7, 8, 9, 7],
    co_secureframe: [6, 9, 9, 8, 8, 8, 8, 9],
  };

  for (const [companyId, scores] of Object.entries(scoreMap)) {
    const scoreItems = criteria.map((c, i) => ({
      id: `${companyId}_${c.id}`,
      companyId,
      criterionId: c.id,
      score: scores[i] ?? 5,
      updatedAt: new Date(),
    }));

    await Promise.all(
      scoreItems.map((s) =>
        db.scoreDetail.upsert({
          where: { id: s.id },
          update: {},
          create: s,
        })
      )
    );

    // Calculate total score
    let weightedSum = 0;
    let totalWeight = 0;
    scoreItems.forEach((s, i) => {
      weightedSum += s.score * criteria[i].weight;
      totalWeight += criteria[i].weight;
    });
    const totalScore = Math.round((weightedSum / totalWeight) * 10) / 10;

    await db.company.update({
      where: { id: companyId },
      data: { totalScore },
    });
  }
  console.log(`  ✓ Scores for ${Object.keys(scoreMap).length} companies`);

  // --- Interactions ---
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  const interactionsData = [
    {
      id: "int_1",
      type: "EMAIL",
      direction: "OUTBOUND",
      subject: "Quick intro — growth equity perspective on POS space",
      content: "Hi Sarah, I've been following Revel's growth in enterprise restaurants closely. Would love to connect for 15 minutes to share some observations from our portfolio work in vertical SaaS.",
      date: daysAgo(14),
      followUpDate: daysAgo(-3),
      companyId: "co_revel_systems",
      contactId: "contact_sarah_co_revel_systems",
    },
    {
      id: "int_2",
      type: "EMAIL",
      direction: "INBOUND",
      subject: "Re: Quick intro — growth equity perspective on POS space",
      content: "Thanks for reaching out! We're actually in the middle of some interesting decisions around our enterprise expansion. Happy to connect. When works for you?",
      date: daysAgo(11),
      companyId: "co_revel_systems",
      contactId: "contact_sarah_co_revel_systems",
    },
    {
      id: "int_3",
      type: "CALL",
      direction: "OUTBOUND",
      subject: "Intro call — 30 min",
      content: "Great call. Sarah shared some interesting color on their ACV growth with enterprise chains. Retention story is strong. They've been approached by 3 other firms. Decision in 45-60 days. Key questions: GM trajectory, land & expand motion with franchisees.",
      date: daysAgo(7),
      followUpDate: daysAgo(0),
      companyId: "co_revel_systems",
      contactId: "contact_sarah_co_revel_systems",
    },
    {
      id: "int_4",
      type: "EMAIL",
      direction: "OUTBOUND",
      subject: "Following up + sharing relevant resources",
      content: "Sarah, great speaking last week. Sharing a few resources on our portfolio work in vertical SaaS. Looking forward to our deeper conversation next week.",
      date: daysAgo(5),
      companyId: "co_revel_systems",
      contactId: "contact_sarah_co_revel_systems",
    },
    {
      id: "int_5",
      type: "EMAIL",
      direction: "OUTBOUND",
      subject: "Introduction from mutual connection re: Axiom Data",
      content: "Hi David, [mutual connection] suggested I reach out. The work you're doing on real-time data pipelines is really compelling, especially the observability layer. Would love to learn more.",
      date: daysAgo(20),
      followUpDate: daysAgo(-1),
      companyId: "co_axiom_data",
      contactId: "contact_david_co_axiom_data",
    },
    {
      id: "int_6",
      type: "MEETING",
      direction: "OUTBOUND",
      subject: "First meeting — Axiom Data team",
      content: "Met at their office. Impressive team - David previously led eng at Segment. Product velocity is exceptional. ARR growing 145% YoY, $12M ARR. NRR at 124%. Main concern: competitive moat vs. Fivetran/dbt. Ask: $40M Series B to accelerate GTM.",
      date: daysAgo(3),
      followUpDate: daysAgo(-7),
      companyId: "co_axiom_data",
      contactId: "contact_david_co_axiom_data",
    },
    {
      id: "int_7",
      type: "LINKEDIN_MESSAGE",
      direction: "OUTBOUND",
      subject: null,
      content: "Hi Sam, congrats on the recent SOC 2 Type II momentum — I've seen a few of our portfolio companies reference Secureframe. Would love a quick call to share what I'm seeing in the compliance automation space.",
      date: daysAgo(30),
      followUpDate: daysAgo(-14),
      companyId: "co_secureframe",
      contactId: "contact_sam_co_secureframe",
    },
    {
      id: "int_8",
      type: "EMAIL",
      direction: "OUTBOUND",
      subject: "Leapsome — initial diligence questions",
      content: "Christian, following our great intro call, sharing our initial diligence framework. Key areas: cohort retention analysis, AE productivity metrics, and expansion revenue by product line.",
      date: daysAgo(2),
      followUpDate: daysAgo(-14),
      companyId: "co_leapsome",
      contactId: "contact_christian_co_leapsome",
    },
    {
      id: "int_9",
      type: "NOTE",
      direction: "OUTBOUND",
      subject: "IC memo notes — Leapsome",
      content: "Strong thesis: performance mgmt + OKRs + L&D is a natural bundling opportunity. Main risk is Lattice and Culture Amp have similar roadmaps. Differentiator: European market penetration and GDPR compliance. Ask to see ARR bridge and customer logos.",
      date: daysAgo(1),
      companyId: "co_leapsome",
    },
  ];

  for (const i of interactionsData) {
    await db.interaction.upsert({
      where: { id: i.id },
      update: {},
      create: i,
    });
  }
  console.log(`  ✓ ${interactionsData.length} interactions`);

  // --- Notes ---
  await db.note.upsert({
    where: { id: "note_1" },
    update: {},
    create: {
      id: "note_1",
      content: "Strong vertical SaaS story. Restaurant chains have very high switching costs once POS is embedded. Need to understand their hardware margin and if they're moving toward a payments layer (Revel Payments). Key question: what's the NRR by cohort vintage?",
      companyId: "co_revel_systems",
    },
  });
  await db.note.upsert({
    where: { id: "note_2" },
    update: {},
    create: {
      id: "note_2",
      content: "Axiom is one of the more technically impressive data infra products I've seen. The real-time query engine on top of the pipeline is genuinely differentiated. Main worry: open source competition from Airbyte. But their enterprise features (RBAC, audit logs, SLAs) create real lock-in.",
      companyId: "co_axiom_data",
    },
  });

  console.log("  ✓ Notes");

  // --- Investment Thesis Criteria ---
  // Sourced directly from the investor's stated preferences.
  // HARD_FILTER = disqualifying if not met; SIGNAL = positive indicator weighted by importance (1–5).
  const thesisData = [
    // ── Hard Filters ─────────────────────────────────────────────────────────
    {
      id: "thesis_founded",
      name: "Founded 2018–2023",
      description: "Company must have been founded between 2018 and 2023. Too early = unproven; too late = too early-stage.",
      category: "HARD_FILTER",
      dataType: "RANGE",
      companyField: "founded",
      minValue: 2018,
      maxValue: 2023,
      unit: "year",
      importance: 5,
      order: 1,
    },
    {
      id: "thesis_employees",
      name: "15–250 Employees",
      description: "Team size indicating post-product but pre-scale — right window for growth capital.",
      category: "HARD_FILTER",
      dataType: "RANGE",
      companyField: "employees",
      minValue: 15,
      maxValue: 250,
      unit: "employees",
      importance: 5,
      order: 2,
    },
    {
      id: "thesis_funding",
      name: "Total Funding < $8M",
      description: "Has raised less than $8M in total life-to-date funding. Avoids over-capitalised companies with inflated expectations.",
      category: "HARD_FILTER",
      dataType: "RANGE",
      companyField: "totalFundingM",
      minValue: null,
      maxValue: 8,
      unit: "$M",
      importance: 5,
      order: 3,
    },
    {
      id: "thesis_independent",
      name: "Independent (not a subsidiary)",
      description: "Company must be a standalone entity, not a division or subsidiary of a larger firm.",
      category: "HARD_FILTER",
      dataType: "BOOLEAN",
      boolField: "isIndependent",
      boolTarget: true,
      importance: 5,
      order: 4,
    },
    {
      id: "thesis_no_tier1",
      name: "No Tier-1 VC Invested",
      description: "No Sequoia, a16z, Benchmark, Accel, etc. Their involvement signals either too hot or misaligned stage.",
      category: "HARD_FILTER",
      dataType: "BOOLEAN",
      boolField: "hasNoTier1VC",
      boolTarget: true,
      importance: 5,
      order: 5,
    },
    {
      id: "thesis_founder_majority",
      name: "Founder Majority Ownership",
      description: "Founder(s) still own the majority. Not PE-owned or majority sold. Ensures alignment and motivation.",
      category: "HARD_FILTER",
      dataType: "BOOLEAN",
      boolField: "founderMajority",
      boolTarget: true,
      importance: 5,
      order: 6,
    },
    // ── Signals ───────────────────────────────────────────────────────────────
    {
      id: "thesis_arr_sweet_spot",
      name: "ARR in $2–4M Sweet Spot",
      description: "ARR in the $2–4M range is the target entry point — proven revenue but room for growth capital to matter.",
      category: "SIGNAL",
      dataType: "RANGE",
      companyField: "arrEstimate",
      minValue: 2,
      maxValue: 4,
      unit: "$M",
      importance: 4,
      order: 7,
    },
    {
      id: "thesis_b2b_enterprise",
      name: "B2B Enterprise Focused",
      description: "Sells to businesses, not consumers. Enterprise or mid-market buyer, not SMB-only.",
      category: "SIGNAL",
      dataType: "TEXT",
      importance: 5,
      notes: "Look for: enterprise customer logos, multi-seat deals, procurement involvement, legal/security review in sales cycle.",
      order: 8,
    },
    {
      id: "thesis_vertical_software",
      name: "Vertical Software",
      description: "Purpose-built for a specific industry, not a horizontal point solution. Deep workflow integration beats broad but shallow.",
      category: "SIGNAL",
      dataType: "TEXT",
      importance: 5,
      notes: "Check: does the product require industry-specific config/knowledge? Would a generic CRM or ERP replace it? If yes, it's horizontal.",
      order: 9,
    },
    {
      id: "thesis_strategic_acquirer",
      name: "Attractive to Strategic Acquirers",
      description: "A large strategic (incumbent software vendor, PE roll-up platform, or industry giant) would plausibly want to buy this one day.",
      category: "SIGNAL",
      dataType: "TEXT",
      importance: 4,
      notes: "Think: who are the obvious buyers? Industry incumbents, adjacent platform players, or PE-backed vertical consolidators in the space.",
      order: 10,
    },
    {
      id: "thesis_digital_lag",
      name: "Serves Industry Behind on Digital Adoption",
      description: "Targeting an industry that is still paper-heavy, spreadsheet-run, or underserved by modern software — more whitespace and less competition.",
      category: "SIGNAL",
      dataType: "TEXT",
      importance: 3,
      notes: "Examples: trades/field service, agriculture, legal, healthcare admin, construction, logistics, government. These often have high willingness to pay once trust is established.",
      order: 11,
    },
    {
      id: "thesis_regulatory_lock_in",
      name: "Regulatory / Compliance Lock-in",
      description: "Product creates stickiness through regulatory compliance requirements, audit trails, or certification workflows. High gross dollar retention.",
      category: "SIGNAL",
      dataType: "TEXT",
      importance: 4,
      notes: "Look for: mandatory usage, SOC 2 / HIPAA / FDA / AML requirements, audit log dependency, or government mandate as the forcing function to buy.",
      order: 12,
    },
    {
      id: "thesis_pain_killer",
      name: "Pain Killer, Not a Vitamin",
      description: "Solves a must-have problem evidenced by decent ACVs (>$10K). High ACV = real pain, real budget, real product-market fit.",
      category: "SIGNAL",
      dataType: "TEXT",
      importance: 5,
      notes: "Red flags: very low ACV (<$3K), high churn, described as 'nice to have', or heavily discounted. Green flags: multi-year contracts, expansion revenue, strong NRR.",
      order: 13,
    },
  ];

  for (const t of thesisData) {
    await db.thesisCriterion.upsert({
      where: { id: t.id },
      update: {},
      create: {
        ...t,
        minValue: t.minValue ?? null,
        maxValue: t.maxValue ?? null,
        companyField: t.companyField ?? null,
        boolField: t.boolField ?? null,
        boolTarget: t.boolTarget ?? null,
        unit: t.unit ?? null,
        notes: t.notes ?? null,
      },
    });
  }
  console.log(`  ✓ ${thesisData.length} thesis criteria`);

  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
