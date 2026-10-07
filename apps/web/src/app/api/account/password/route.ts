import { z } from "zod";
import { json, parseBody, withAuth } from "@/lib/api";
import { passwordSchema } from "@/lib/schemas";
import { changeOwnPassword } from "@/server/users";

const schema = z.object({ current: z.string().min(1), next: passwordSchema });

export const POST = withAuth(async (req, { session }) => {
  const { current, next } = await parseBody(req, schema);
  await changeOwnPassword(session.userId, current, next);
  return json({ ok: true });
});
