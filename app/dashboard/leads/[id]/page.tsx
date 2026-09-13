import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current-user";
import { getOwnedBusiness } from "@/lib/db/business-queries";
import { db } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";
import { businessConfigSchema } from "@/lib/config/schema";
import { LeadDetail } from "@/components/leads/lead-detail";

export const dynamic = "force-dynamic";

export default async function DashboardLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const business = await getOwnedBusiness(user.id);
  if (!business) throw new Error("No business found for this account.");

  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  // 404, not 403 — don't reveal whether a lead id belonging to another tenant exists at all.
  if (!lead || lead.businessId !== business.id) notFound();

  const config = businessConfigSchema.parse(business.config);
  const questionPrompt = (questionId: string) =>
    config.questions.find((q) => q.id === questionId)?.prompt ?? questionId;

  return (
    <LeadDetail lead={lead} backHref="/dashboard/leads" backLabel="Back to your leads" questionPrompt={questionPrompt} />
  );
}
