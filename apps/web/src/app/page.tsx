import { redirect } from "next/navigation";
import { isDbConfigured } from "@octopus/db";
import { getSession } from "@/lib/auth";
import { missingEnv } from "@/lib/env";

export default async function Home() {
  if (missingEnv().length) redirect("/setup");
  if (!isDbConfigured()) redirect("/setup");
  redirect((await getSession()) ? "/dashboard" : "/login");
}
