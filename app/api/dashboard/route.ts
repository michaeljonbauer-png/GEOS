import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subDays } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      totalCompanies,
      statusCounts,
      recentInteractions,
      upcomingFollowUps,
      topCompanies,
      recentlyAdded,
      interactionsByType,
    ] = await Promise.all([
      db.company.count(),
      db.company.groupBy({ by: ["status"], _count: true }),
      db.interaction.findMany({
        where: { date: { gte: subDays(new Date(), 30) } },
        include: {
          company: { select: { id: true, name: true } },
          contact: { select: { firstName: true, lastName: true } },
        },
        orderBy: { date: "desc" },
        take: 10,
      }),
      db.interaction.findMany({
        where: {
          followUpDate: { gte: new Date(), lte: subDays(new Date(), -14) },
          followUpDone: false,
        },
        include: { company: { select: { id: true, name: true } } },
        orderBy: { followUpDate: "asc" },
        take: 5,
      }),
      db.company.findMany({
        where: { totalScore: { not: null } },
        orderBy: { totalScore: "desc" },
        take: 5,
        select: { id: true, name: true, sector: true, totalScore: true, status: true, arrEstimate: true },
      }),
      db.company.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, sector: true, status: true, createdAt: true },
      }),
      db.interaction.groupBy({
        by: ["type"],
        _count: true,
        where: { date: { gte: subDays(new Date(), 30) } },
      }),
    ]);

    const pipeline = {
      IDENTIFIED: 0,
      QUALIFYING: 0,
      REACHED_OUT: 0,
      IN_CONVERSATION: 0,
      MEETING_SCHEDULED: 0,
      DUE_DILIGENCE: 0,
      PASSED: 0,
      INVESTED: 0,
      MONITORING: 0,
    } as Record<string, number>;

    statusCounts.forEach((s) => {
      pipeline[s.status] = s._count;
    });

    const activeDeals = (pipeline.QUALIFYING ?? 0) +
      (pipeline.REACHED_OUT ?? 0) +
      (pipeline.IN_CONVERSATION ?? 0) +
      (pipeline.MEETING_SCHEDULED ?? 0) +
      (pipeline.DUE_DILIGENCE ?? 0);

    return NextResponse.json({
      totalCompanies,
      activeDeals,
      invested: pipeline.INVESTED ?? 0,
      pipeline,
      recentInteractions,
      upcomingFollowUps,
      topCompanies,
      recentlyAdded,
      interactionsByType,
    });
  } catch (error) {
    console.error(error);
    // Return a safe empty shape so the UI renders instead of crashing
    return NextResponse.json({
      totalCompanies: 0, activeDeals: 0, invested: 0,
      pipeline: { IDENTIFIED: 0, QUALIFYING: 0, REACHED_OUT: 0, IN_CONVERSATION: 0, MEETING_SCHEDULED: 0, DUE_DILIGENCE: 0, PASSED: 0, INVESTED: 0, MONITORING: 0 },
      recentInteractions: [], upcomingFollowUps: [], topCompanies: [], recentlyAdded: [], interactionsByType: [],
    });
  }
}
