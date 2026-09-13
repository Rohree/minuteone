import { eq } from "drizzle-orm";
import { db } from "./client";
import { businesses, type BusinessRow } from "./schema";

/** v1 assumes exactly one business per account. */
export async function getOwnedBusiness(ownerUserId: string): Promise<BusinessRow | null> {
  const [row] = await db.select().from(businesses).where(eq(businesses.ownerUserId, ownerUserId)).limit(1);
  return row ?? null;
}
