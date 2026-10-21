import { redirect } from "next/navigation";

// Outreach drafting now lives on each company and contact profile.
export default function OutreachRedirect({ searchParams }: { searchParams: { companyId?: string } }) {
  redirect(searchParams.companyId ? `/companies/${searchParams.companyId}?outreach=1` : "/companies");
}
