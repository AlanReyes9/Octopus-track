import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/app/auth-form";
import { signupEnabled } from "@/lib/auth";

export const metadata: Metadata = { title: "Crear cuenta" };
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  if (!signupEnabled()) redirect("/login");
  return <AuthForm mode="register" signupEnabled />;
}
