import { notFound } from "next/navigation";
import { LeadForm } from "@/app/lead-form";
import { loadBusinessConfigBySlug } from "@/lib/config/load";

/** The embeddable public lead-capture form for one business — <iframe src=".../f/[slug]">. */
export default async function EmbeddableLeadFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const resolved = await loadBusinessConfigBySlug(slug);
  if (!resolved) notFound();
  const { config } = resolved;

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">{config.business.name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Request a callback</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Submit your details below and we&apos;ll call you back shortly.
          </p>
        </div>
        <LeadForm businessSlug={slug} />
      </div>
    </div>
  );
}
