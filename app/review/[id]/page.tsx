import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";
import { loadBusinessConfigForLead } from "@/lib/config/load";
import { LeadDetail } from "@/components/leads/lead-detail";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!lead) notFound();

  // Falls back to the seeded "default" tenant for any legacy lead that predates businessId.
  const { config } = await loadBusinessConfigForLead(lead.businessId);
  const questionPrompt = (questionId: string) =>
    config.questions.find((q) => q.id === questionId)?.prompt ?? questionId;

  return (
    <LeadDetail lead={lead} backHref="/review" backLabel="Back to review console" questionPrompt={questionPrompt} />
  );
}
