import Link from "next/link";
import { LeadForm } from "./lead-form";
import { loadBusinessConfig } from "@/lib/config/load";

export default function Home() {
  const config = loadBusinessConfig();

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">{config.business.name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">MinuteOne demo</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Submit a lead below to see an instant callback agent in action (dry-run by default —
            no real call is placed).
          </p>
        </div>
        <LeadForm />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/review" className="underline underline-offset-2">
            Open the review console
          </Link>
        </p>
      </div>
    </div>
  );
}
