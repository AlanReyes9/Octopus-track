import type { Metadata } from "next";
import { AuthForm } from "@/components/app/auth-form";
import { signupEnabled } from "@/lib/auth";

export const metadata: Metadata = { title: "Iniciar sesión" };
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <AuthForm mode="login" signupEnabled={signupEnabled()} />;
}
