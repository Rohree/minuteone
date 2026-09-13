import { and, desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current-user";
import { getOwnedBusiness } from "@/lib/db/business-queries";
import { db } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";
import { AutoRefresh } from "@/components/leads/auto-refresh";
import { LeadStats } from "@/components/leads/lead-stats";
import { LeadTable } from "@/components/leads/lead-table";

export const dynamic = "force-dynamic";

export default async function DashboardLeadsPage() {
  const user = await requireUser();
  const business = await getOwnedBusiness(user.id);
  if (!business) throw new Error("No business found for this account.");

  const rows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.businessId, business.id)))
    .orderBy(desc(leads.createdAt));

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <AutoRefresh />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Your leads</h1>
        <p className="text-sm text-muted-foreground">
          Leads submitted through your embeddable form move pending → in_progress → done as the
          worker dispatches calls.
        </p>
      </div>

      <LeadStats rows={rows} />

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No leads yet — share your embed link from the Embed tab.
        </p>
      ) : (
        <LeadTable rows={rows} detailBasePath="/dashboard/leads" />
      )}
    </div>
  );
}
