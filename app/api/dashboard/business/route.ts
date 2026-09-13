import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { businesses } from "@/lib/db/schema";
import { businessConfigSchema } from "@/lib/config/schema";
import { getCurrentUser } from "@/lib/auth/current-user";

/** Updates the caller's own business config. Ownership is enforced in the WHERE, not just auth. */
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = businessConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await db
    .update(businesses)
    .set({ config: parsed.data, updatedAt: new Date() })
    .where(and(eq(businesses.ownerUserId, user.id)))
    .returning({ id: businesses.id });

  if (updated.length === 0) {
    return NextResponse.json({ error: "No business found for this account" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
