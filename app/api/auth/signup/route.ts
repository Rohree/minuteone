import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, businesses } from "@/lib/db/schema";
import { signupSchema } from "@/lib/auth/schema";
import { hashPassword } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { generateUniqueSlug } from "@/lib/config/slug";
import { businessConfigSchema } from "@/lib/config/schema";
import exampleConfig from "@/lib/config/business.example.json";

/**
 * Creates the account, an initial business row cloned from the same seed config the "default"
 * demo tenant uses (see lib/db/seed.ts) with the user's own business name, then signs them in.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);
  if (existing) {
    return NextResponse.json({ error: { email: ["Email is already registered"] } }, { status: 409 });
  }

  const userId = randomUUID();
  const passwordHash = await hashPassword(parsed.data.password);
  await db.insert(users).values({ id: userId, email: parsed.data.email, passwordHash });

  const seedConfig = businessConfigSchema.parse(exampleConfig);
  const config = businessConfigSchema.parse({
    ...seedConfig,
    business: { ...seedConfig.business, name: parsed.data.businessName },
  });
  const slug = await generateUniqueSlug(parsed.data.businessName);
  const businessId = randomUUID();
  await db.insert(businesses).values({ id: businessId, ownerUserId: userId, slug, config });

  const { token, expiresAt } = await createSession(userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return NextResponse.json({ businessSlug: slug }, { status: 201 });
}
