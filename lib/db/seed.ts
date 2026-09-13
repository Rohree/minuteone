import { randomUUID } from "crypto";
import { eq, isNull } from "drizzle-orm";
import { db } from "./client";
import { users, businesses, leads } from "./schema";
import { businessConfigSchema } from "../config/schema";
import { DEFAULT_BUSINESS_SLUG } from "../config/load";
import exampleConfig from "../config/business.example.json";

const DEFAULT_USER_EMAIL = "default@minuteone.local";

/**
 * Idempotent — safe to re-run against a fresh DB, an existing dev DB, or the live Turso instance.
 * Ensures the seeded "default" tenant exists (so `/` and `/review` keep working unchanged) and
 * backfills businessId onto any lead row that predates the multi-tenant schema.
 */
export async function seed(): Promise<void> {
  let [defaultUser] = await db.select().from(users).where(eq(users.email, DEFAULT_USER_EMAIL)).limit(1);
  if (!defaultUser) {
    [defaultUser] = await db
      .insert(users)
      .values({
        id: randomUUID(),
        email: DEFAULT_USER_EMAIL,
        // Not a valid "scrypt:<salt>:<hash>" value on purpose — this account can never log in.
        passwordHash: "disabled",
      })
      .returning();
    console.log(`Seeded default system user (${defaultUser.id}).`);
  }

  let [defaultBusiness] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.slug, DEFAULT_BUSINESS_SLUG))
    .limit(1);
  if (!defaultBusiness) {
    const config = businessConfigSchema.parse(exampleConfig);
    [defaultBusiness] = await db
      .insert(businesses)
      .values({
        id: randomUUID(),
        ownerUserId: defaultUser.id,
        slug: DEFAULT_BUSINESS_SLUG,
        config,
      })
      .returning();
    console.log(`Seeded default business (${defaultBusiness.id}).`);
  }

  const backfilled = await db
    .update(leads)
    .set({ businessId: defaultBusiness.id })
    .where(isNull(leads.businessId))
    .returning({ id: leads.id });
  if (backfilled.length > 0) {
    console.log(`Backfilled businessId on ${backfilled.length} pre-existing lead(s).`);
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
