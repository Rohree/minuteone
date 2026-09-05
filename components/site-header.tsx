import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          MinuteOne
        </Link>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Lead form
          </Link>
          <Link href="/review" className="hover:text-foreground">
            Review console
          </Link>
        </nav>
      </div>
    </header>
  );
}
