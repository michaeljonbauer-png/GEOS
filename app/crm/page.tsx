import { redirect } from "next/navigation";

// The activity log now lives on the Sourcing / CRM dashboard.
export default function ActivityRedirect() {
  redirect("/#activity");
}
