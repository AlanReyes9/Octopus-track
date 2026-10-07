import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canManage, getSession, type Session } from "./auth";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

type Handler<C> = (req: Request, ctx: C & { session: Session }) => Promise<Response>;

/**
 * Envuelve un Route Handler exigiendo sesión (y rol de gestión si `manage`).
 * Toda consulta posterior se filtra por session.tenantId.
 */
export function withAuth<C = unknown>(handler: Handler<C>, opts: { manage?: boolean } = {}) {
  return async (req: Request, ctx: C) => {
    try {
      const session = await getSession();
      if (!session) throw new HttpError(401, "No autenticado");
      if (opts.manage && !canManage(session.role)) throw new HttpError(403, "Permisos insuficientes");
      return await handler(req, { ...ctx, session });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return json({ error: err.message }, err.status);
  if (err instanceof z.ZodError) return json({ error: "Datos inválidos", issues: err.issues }, 400);
  // drizzle envuelve el error de PostgreSQL en `cause`.
  const pgErr = (err as { cause?: { code?: string }; code?: string }) ?? {};
  const code = pgErr.cause?.code ?? pgErr.code;
  if (code === "23505") return json({ error: "Ya existe un registro con ese valor único" }, 409);
  if (code === "22P02") return json({ error: "Identificador inválido" }, 400);
  console.error(err);
  return json({ error: "Error interno" }, 500);
}

export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  const body = await req.json().catch(() => {
    throw new HttpError(400, "JSON inválido");
  });
  return schema.parse(body);
}
