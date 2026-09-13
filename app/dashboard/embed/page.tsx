import { requireUser } from "@/lib/auth/current-user";
import { getOwnedBusiness } from "@/lib/db/business-queries";
import { EmbedSnippet } from "./embed-snippet";

export const dynamic = "force-dynamic";

export default async function EmbedPage() {
  const user = await requireUser();
  const business = await getOwnedBusiness(user.id);
  if (!business) throw new Error("No business found for this account.");

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Embed your form</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Add this to your website so prospects can request a callback directly.
      </p>
      <div className="mt-6">
        <EmbedSnippet slug={business.slug} />
      </div>
    </div>
  );
}
