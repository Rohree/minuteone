import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import logo from "@/public/logo.png";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center">
          <Image src={logo} alt="MinuteOne" className="h-7 w-auto" priority />
        </Link>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Lead form
          </Link>
          <Link href="/review" className="hover:text-foreground">
            Review console
          </Link>
          {user ? (
            <Link href="/dashboard/settings" className="hover:text-foreground">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="hover:text-foreground">
                Log in
              </Link>
              <Link href="/signup" className="hover:text-foreground">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
