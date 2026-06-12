import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage() {
  if (await isAuthed()) redirect("/profiles");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <div className="text-6xl">🍽️</div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">FoodFinder</h1>
        <p className="mt-1 text-muted">The family restaurant picker</p>
      </div>
      <LoginForm />
    </main>
  );
}
