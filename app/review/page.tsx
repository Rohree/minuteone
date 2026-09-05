import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoRefresh } from "./auto-refresh";
import { CancelButton } from "./cancel-button";
import { statusVariant, outcomeVariant } from "./badge-variants";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const rows = await db.select().from(leads).orderBy(desc(leads.createdAt));

  const doneRows = rows.filter((lead) => lead.status === "done");
  const qualifiedCount = doneRows.filter((lead) => lead.outcome === "qualified").length;
  const pendingCount = rows.filter((lead) => lead.status === "pending" || lead.status === "in_progress").length;
  const avgScore =
    doneRows.length > 0
      ? Math.round(doneRows.reduce((sum, lead) => sum + (lead.score ?? 0), 0) / doneRows.length)
      : null;

  const stats: { label: string; value: string | number }[] = [
    { label: "Total leads", value: rows.length },
    { label: "Awaiting dispatch", value: pendingCount },
    { label: "Qualified", value: qualifiedCount },
    { label: "Avg. score (done)", value: avgScore ?? "—" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <AutoRefresh />
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review console</h1>
          <p className="text-sm text-muted-foreground">
            Leads move pending → in_progress → done as the worker dispatches calls.
          </p>
        </div>
        <Link href="/" className="text-sm underline underline-offset-2">
          ← Back to lead form
        </Link>
      </div>

      {rows.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="py-4">
              <CardContent className="px-4">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No leads yet — submit one from the home page.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Next action</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">
                    <Link href={`/review/${lead.id}`} className="underline-offset-2 hover:underline">
                      {lead.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{lead.phone}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(lead.status)}>{lead.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {lead.outcome ? (
                      <Badge variant={outcomeVariant(lead.outcome)}>{lead.outcome}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{lead.score ?? "—"}</TableCell>
                  <TableCell>{lead.nextAction ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {lead.createdAt.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {lead.status === "pending" && <CancelButton leadId={lead.id} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
