import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";
import { loadBusinessConfig } from "@/lib/config/load";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { statusVariant, outcomeVariant } from "../badge-variants";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!lead) notFound();

  const config = loadBusinessConfig();
  const questionPrompt = (questionId: string) =>
    config.questions.find((q) => q.id === questionId)?.prompt ?? questionId;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/review" className="text-sm underline underline-offset-2">
        ← Back to review console
      </Link>

      <div className="mt-4 mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{lead.name}</h1>
        <Badge variant={statusVariant(lead.status)}>{lead.status}</Badge>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Intake</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <Row label="Phone" value={lead.phone} />
          <Row label="Email" value={lead.email ?? "—"} />
          <Row label="Source" value={lead.source} />
          <Row label="Notes" value={lead.notes ?? "—"} />
          <Row label="Consent" value={lead.consent ? "Yes" : "No"} />
          <Row label="Submitted" value={lead.createdAt.toLocaleString()} />
        </CardContent>
      </Card>

      {lead.status === "done" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">LeadCard</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <Row
              label="Outcome"
              value={<Badge variant={outcomeVariant(lead.outcome ?? "")}>{lead.outcome}</Badge>}
            />
            <Row label="Score" value={`${lead.score ?? 0} / 100`} />
            <Row label="Next action" value={lead.nextAction ?? "—"} />
            <Row label="Summary" value={lead.summary ?? "—"} />
            <Row label="Call ID" value={lead.callId ?? "—"} />
            <Row label="Duration" value={lead.durationS != null ? `${lead.durationS}s` : "—"} />

            {lead.answers && lead.answers.length > 0 && (
              <>
                <Separator className="my-2" />
                <p className="font-medium">Answers</p>
                <div className="grid gap-2">
                  {lead.answers.map((a) => (
                    <div key={a.questionId}>
                      <p className="text-muted-foreground">{questionPrompt(a.questionId)}</p>
                      <p>{a.value || "—"}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          {lead.status === "pending" &&
            "Waiting for the worker to dispatch this lead (business hours + retry policy apply)."}
          {lead.status === "in_progress" && "Call in progress…"}
          {lead.status === "failed" && (lead.summary ?? "Dispatch failed.")}
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="col-span-2">{value}</span>
    </div>
  );
}
