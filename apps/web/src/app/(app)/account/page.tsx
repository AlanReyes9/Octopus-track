import type { Metadata } from "next";
import { AccountForm } from "@/components/app/account-form";
import { PageHeader } from "@/components/app/page-header";
import { PushCard } from "@/components/app/push-card";
import { requireSession } from "@/lib/guards";
import { getUserFlags } from "@/server/users";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function AccountPage() {
  const session = await requireSession();
  const flags = await getUserFlags(session.userId);
  return (
    <>
      <PageHeader title="Mi cuenta" description={flags?.email} />
      <div className="flex flex-wrap items-start gap-6 p-6">
        <AccountForm forced={!!flags?.mustChangePassword} />
        <PushCard />
      </div>
    </>
  );
}
