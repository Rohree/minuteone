import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { LogoutButton } from "./logout-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div>
      <div className="border-b bg-background">
        <nav className="mx-auto flex max-w-5xl gap-4 px-6 py-3 text-sm text-muted-foreground">
          <Link href="/dashboard/settings" className="hover:text-foreground">
            Business settings
          </Link>
          <Link href="/dashboard/leads" className="hover:text-foreground">
            Leads
          </Link>
          <Link href="/dashboard/embed" className="hover:text-foreground">
            Embed
          </Link>
          <span className="ml-auto">
            <LogoutButton />
          </span>
        </nav>
      </div>
      {children}
    </div>
  );
}
