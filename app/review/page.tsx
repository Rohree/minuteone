import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoRefresh } from "./auto-refresh";
import { statusVariant, outcomeVariant } from "./badge-variants";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const rows = await db.select().from(leads).orderBy(desc(leads.createdAt));

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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
