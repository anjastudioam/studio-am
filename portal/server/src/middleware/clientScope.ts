import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { clients } from "../db/schema";
import { HttpError, wrap } from "../http";
import { createScope } from "../scope/clientScope";

/**
 * Resolves /api/c/:slug to a client and attaches a ClientScope.
 * A client user asking for any client other than their own gets a plain 404,
 * the same response as a client that does not exist, so nothing leaks.
 */
export function resolveClient(db: Db) {
  return wrap(async (req, _res, next) => {
    const user = req.user;
    if (!user) throw new HttpError(401, "Not signed in");

    const slug = String(req.params.slug ?? "").toLowerCase();
    const [client] = await db.select().from(clients).where(eq(clients.slug, slug)).limit(1);

    const notFound = new HttpError(404, "Not found");
    if (!client) throw notFound;
    if (user.role === "CLIENT") {
      if (user.clientId !== client.id) throw notFound;
      if (client.status === "ARCHIVED") throw notFound;
    }

    req.client = { id: client.id, name: client.name, slug: client.slug, status: client.status };
    req.scope = createScope(db, client.id);
    next();
  });
}
