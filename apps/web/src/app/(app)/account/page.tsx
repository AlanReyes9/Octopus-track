import type { Metadata } from "next";
import { AccountForm } from "@/components/app/account-form";
import { PageHeader } from "@/components/app/page-header";
import { requireSession } from "@/lib/guards";
import { getUserFlags } from "@/server/users";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function AccountPage() {
  const session = await requireSession();
  const flags = await getUserFlags(session.userId);
  return (
    <>
      <PageHeader title="Mi cuenta" description={flags?.email} />
      <div className="p-6">
        <AccountForm forced={!!flags?.mustChangePassword} />
      </div>
    </>
  );
}
