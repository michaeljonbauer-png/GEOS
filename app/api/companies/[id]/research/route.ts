import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const research = await db.companyResearch.findUnique({
      where: { companyId: params.id },
    });
    return NextResponse.json(research ?? { companyId: params.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch research" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // Compute product reputation score from review ratings
    const reviewSources = [
      { rating: body.g2Rating, count: body.g2ReviewCount },
      { rating: body.capterraRating, count: body.capterraReviewCount },
      { rating: body.gartnerRating, count: body.gartnerReviewCount },
      { rating: body.trustpilotRating, count: body.trustpilotReviewCount },
    ].filter(
      (s) =>
        s.rating !== null &&
        s.rating !== undefined &&
        s.count !== null &&
        s.count !== undefined &&
        s.count > 0
    ) as { rating: number; count: number }[];

    let productRepScore: number | null = null;
    if (reviewSources.length > 0) {
      let weightedSum = 0;
      let totalWeight = 0;
      for (const s of reviewSources) {
        // Log scale weight — 100 reviews isn't 100x more trustworthy than 1
        const weight = Math.log10(s.count + 1);
        // Normalize rating to 0–10 (assuming 5-star scale)
        weightedSum += (s.rating / 5) * 10 * weight;
        totalWeight += weight;
      }
      productRepScore = Math.round((weightedSum / totalWeight) * 10) / 10;
    }

    // Numeric coercion for optional float/int fields
    const coerce = (v: unknown, type: "float" | "int") => {
      if (v === null || v === undefined || v === "") return null;
      return type === "int" ? parseInt(String(v)) : parseFloat(String(v));
    };

    const data = {
      g2Url: body.g2Url ?? null,
      g2Rating: coerce(body.g2Rating, "float"),
      g2ReviewCount: coerce(body.g2ReviewCount, "int"),
      g2Category: body.g2Category ?? null,
      g2Momentum: body.g2Momentum ?? null,
      capterraUrl: body.capterraUrl ?? null,
      capterraRating: coerce(body.capterraRating, "float"),
      capterraReviewCount: coerce(body.capterraReviewCount, "int"),
      gartnerUrl: body.gartnerUrl ?? null,
      gartnerRating: coerce(body.gartnerRating, "float"),
      gartnerReviewCount: coerce(body.gartnerReviewCount, "int"),
      trustpilotUrl: body.trustpilotUrl ?? null,
      trustpilotRating: coerce(body.trustpilotRating, "float"),
      trustpilotReviewCount: coerce(body.trustpilotReviewCount, "int"),
      similarwebUrl: body.similarwebUrl ?? null,
      monthlyVisits: coerce(body.monthlyVisits, "int"),
      trafficTrend: body.trafficTrend ?? null,
      globalRank: coerce(body.globalRank, "int"),
      trafficSources: body.trafficSources ?? null,
      crunchbaseSlug: body.crunchbaseSlug ?? null,
      lastFundingType: body.lastFundingType ?? null,
      lastFundingAmount: coerce(body.lastFundingAmount, "float"),
      lastFundingDate: body.lastFundingDate ?? null,
      keyInvestors: body.keyInvestors ?? null,
      pitchbookUrl: body.pitchbookUrl ?? null,
      harmonicUrl: body.harmonicUrl ?? null,
      grataUrl: body.grataUrl ?? null,
      sourcescrubUrl: body.sourcescrubUrl ?? null,
      gartnerMQUrl: body.gartnerMQUrl ?? null,
      forresterUrl: body.forresterUrl ?? null,
      recentNews: body.recentNews ?? null,
      caseStudyUrl: body.caseStudyUrl ?? null,
      keyCustomers: body.keyCustomers ?? null,
      testimonialsUrl: body.testimonialsUrl ?? null,
      researchNotes: body.researchNotes ?? null,
      productRepScore,
      lastResearched: new Date(),
      updatedAt: new Date(),
    };

    const research = await db.companyResearch.upsert({
      where: { companyId: params.id },
      create: { companyId: params.id, ...data },
      update: data,
    });

    // Cache score on company record
    if (productRepScore !== null) {
      await db.company.update({
        where: { id: params.id },
        data: { productRepScore },
      });
    }

    return NextResponse.json(research);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save research" }, { status: 500 });
  }
}
