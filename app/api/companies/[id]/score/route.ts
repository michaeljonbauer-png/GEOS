import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    // body: { scores: [{ criterionId, score, notes }] }
    const { scores } = body as {
      scores: { criterionId: string; score: number; notes?: string }[];
    };

    if (!scores || !Array.isArray(scores)) {
      return NextResponse.json({ error: "scores array required" }, { status: 400 });
    }

    // Upsert each score detail
    await Promise.all(
      scores.map((s) =>
        db.scoreDetail.upsert({
          where: {
            id: `${params.id}_${s.criterionId}`,
          },
          create: {
            id: `${params.id}_${s.criterionId}`,
            companyId: params.id,
            criterionId: s.criterionId,
            score: s.score,
            notes: s.notes ?? null,
            updatedAt: new Date(),
          },
          update: {
            score: s.score,
            notes: s.notes ?? null,
            updatedAt: new Date(),
          },
        })
      )
    );

    // Recalculate total weighted score
    const criteria = await db.criterion.findMany({ where: { isActive: true } });
    const scoreDetails = await db.scoreDetail.findMany({
      where: { companyId: params.id },
    });

    const scoreMap = new Map(scoreDetails.map((s) => [s.criterionId, s.score]));
    let totalWeight = 0;
    let weightedSum = 0;

    for (const criterion of criteria) {
      const s = scoreMap.get(criterion.id);
      if (s !== undefined) {
        weightedSum += s * criterion.weight;
        totalWeight += criterion.weight;
      }
    }

    const totalScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    const company = await db.company.update({
      where: { id: params.id },
      data: { totalScore: Math.round(totalScore * 10) / 10 },
    });

    return NextResponse.json({ totalScore: company.totalScore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save scores" }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scoreDetails = await db.scoreDetail.findMany({
      where: { companyId: params.id },
      include: { criterion: true },
      orderBy: { criterion: { order: "asc" } },
    });
    return NextResponse.json(scoreDetails);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch scores" }, { status: 500 });
  }
}
