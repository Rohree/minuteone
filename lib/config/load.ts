import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { businesses } from "../db/schema";
import { businessConfigSchema, type BusinessConfig } from "./schema";

/** The seeded single-tenant business every pre-existing lead/route falls back to. See lib/db/seed.ts. */
export const DEFAULT_BUSINESS_SLUG = "default";

/** Throws if the id doesn't resolve — callers that can't guarantee it exists should check first. */
export async function loadBusinessConfig(businessId: string): Promise<BusinessConfig> {
  const [row] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!row) throw new Error(`Unknown business: ${businessId}`);
  return businessConfigSchema.parse(row.config);
}

export async function loadBusinessConfigBySlug(
  slug: string,
): Promise<{ id: string; config: BusinessConfig } | null> {
  const [row] = await db.select().from(businesses).where(eq(businesses.slug, slug)).limit(1);
  if (!row) return null;
  return { id: row.id, config: businessConfigSchema.parse(row.config) };
}

/**
 * Resolves a lead's own business config, falling back to the seeded default tenant for any
 * legacy row that predates the businessId column (see lib/db/schema.ts's businessId comment).
 */
export async function loadBusinessConfigForLead(
  businessId: string | null,
): Promise<{ id: string; config: BusinessConfig }> {
  if (businessId) {
    const config = await loadBusinessConfig(businessId);
    return { id: businessId, config };
  }
  const fallback = await loadBusinessConfigBySlug(DEFAULT_BUSINESS_SLUG);
  if (!fallback) throw new Error("Default business is not seeded — run `npm run db:seed`.");
  return fallback;
}
