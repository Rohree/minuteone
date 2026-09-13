import { requireUser } from "@/lib/auth/current-user";
import { getOwnedBusiness } from "@/lib/db/business-queries";
import { businessConfigSchema } from "@/lib/config/schema";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const business = await getOwnedBusiness(user.id);
  if (!business) throw new Error("No business found for this account.");

  const config = businessConfigSchema.parse(business.config);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Business settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        This drives your call script — no code changes needed for a new opening line, questions,
        scoring, or business-hours window.
      </p>
      <div className="mt-6">
        <SettingsForm initialConfig={config} />
      </div>
    </div>
  );
}
