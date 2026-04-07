import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const COMPANY_STATUSES = [
  { value: "IDENTIFIED", label: "Identified", color: "bg-slate-100 text-slate-700" },
  { value: "QUALIFYING", label: "Qualifying", color: "bg-blue-100 text-blue-700" },
  { value: "REACHED_OUT", label: "Reached Out", color: "bg-yellow-100 text-yellow-700" },
  { value: "IN_CONVERSATION", label: "In Conversation", color: "bg-orange-100 text-orange-700" },
  { value: "MEETING_SCHEDULED", label: "Meeting Scheduled", color: "bg-purple-100 text-purple-700" },
  { value: "DUE_DILIGENCE", label: "Due Diligence", color: "bg-indigo-100 text-indigo-700" },
  { value: "PASSED", label: "Passed", color: "bg-red-100 text-red-700" },
  { value: "INVESTED", label: "Invested", color: "bg-green-100 text-green-700" },
  { value: "MONITORING", label: "Monitoring", color: "bg-teal-100 text-teal-700" },
] as const;

export const PIPELINE_STAGES = [
  "IDENTIFIED",
  "QUALIFYING",
  "REACHED_OUT",
  "IN_CONVERSATION",
  "MEETING_SCHEDULED",
  "DUE_DILIGENCE",
] as const;

export const INTERACTION_TYPES = [
  { value: "EMAIL", label: "Email" },
  { value: "LINKEDIN_MESSAGE", label: "LinkedIn Message" },
  { value: "CALL", label: "Call" },
  { value: "MEETING", label: "Meeting" },
  { value: "NOTE", label: "Note" },
] as const;

export const SECTORS = [
  "B2B SaaS",
  "FinTech",
  "HealthTech",
  "HR Tech",
  "MarTech",
  "EdTech",
  "CyberSecurity",
  "DevTools",
  "Supply Chain",
  "Legal Tech",
  "PropTech",
  "Data & Analytics",
  "Infrastructure",
  "Other",
] as const;

export const STAGES = [
  "Seed",
  "Series A",
  "Series B",
  "Series C",
  "Growth",
] as const;

export function getStatusConfig(status: string) {
  return (
    COMPANY_STATUSES.find((s) => s.value === status) ?? COMPANY_STATUSES[0]
  );
}

export function formatARR(arr: number | null | undefined): string {
  if (!arr) return "Unknown";
  if (arr >= 1000) return `$${(arr / 1000).toFixed(1)}B`;
  return `$${arr.toFixed(1)}M`;
}

export function formatGrowth(growth: number | null | undefined): string {
  if (growth === null || growth === undefined) return "Unknown";
  return `${growth > 0 ? "+" : ""}${growth.toFixed(0)}%`;
}

export function scoreColor(score: number): string {
  if (score >= 8) return "text-emerald-600";
  if (score >= 6) return "text-green-600";
  if (score >= 4) return "text-yellow-600";
  return "text-red-600";
}

export function scoreBg(score: number): string {
  if (score >= 8) return "bg-emerald-50 border-emerald-200";
  if (score >= 6) return "bg-green-50 border-green-200";
  if (score >= 4) return "bg-yellow-50 border-yellow-200";
  return "bg-red-50 border-red-200";
}
