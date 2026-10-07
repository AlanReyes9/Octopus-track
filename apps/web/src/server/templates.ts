import "server-only";
import { and, commandTemplates, eq, getDb } from "@octopus/db";

export async function listTemplates(tenantId: string) {
  return getDb()
    .select({
      id: commandTemplates.id,
      name: commandTemplates.name,
      protocol: commandTemplates.protocol,
      type: commandTemplates.type,
      params: commandTemplates.params,
    })
    .from(commandTemplates)
    .where(eq(commandTemplates.tenantId, tenantId))
    .orderBy(commandTemplates.name);
}

export async function createTemplate(
  tenantId: string,
  userId: string,
  input: { name: string; protocol: string | null; type: string; params: Record<string, string | number | boolean> },
) {
  const [row] = await getDb()
    .insert(commandTemplates)
    .values({ tenantId, createdBy: userId, ...input })
    .returning({ id: commandTemplates.id });
  return row!;
}

export async function deleteTemplate(tenantId: string, id: string) {
  const rows = await getDb()
    .delete(commandTemplates)
    .where(and(eq(commandTemplates.id, id), eq(commandTemplates.tenantId, tenantId)))
    .returning({ id: commandTemplates.id });
  return rows.length > 0;
}
