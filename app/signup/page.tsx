import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="w-full max-w-md">
        <SignupForm />
      </div>
    </div>
  );
}
