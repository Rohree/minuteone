import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { businesses } from "../db/schema";

const RESERVED_SLUGS = new Set(["default", "api", "dashboard", "login", "signup", "review", "f"]);

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "business";
}

/** Appends a short random suffix on collision (including against reserved route names). */
export async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let attempt = 0;

  while (RESERVED_SLUGS.has(candidate) || (await slugExists(candidate))) {
    attempt += 1;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (attempt > 20) throw new Error("Could not generate a unique business slug.");
  }

  return candidate;
}

async function slugExists(slug: string): Promise<boolean> {
  const [row] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, slug)).limit(1);
  return Boolean(row);
}
