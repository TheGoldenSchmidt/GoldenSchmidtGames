import express, { type Request } from "express";
import { canDevelop } from "../shared/accounts";
import { AccountError, type AccountStore } from "./accountStore";

const COOKIE = "gsg_session";
export function sessionCookie(header?: string) {
  return header?.split(";").map(value => value.trim()).find(value => value.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
}
const local = (request: Request) => ["localhost", "127.0.0.1", "[::1]"].includes(request.hostname);

export function accountRoutes(store: AccountStore, onLogout: (token: string) => void) {
  const router = express.Router();
  const attempts = new Map<string, { count: number; until: number }>();
  let hashing = 0;
  router.use((_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });
  router.use((request, _response, next) => {
    if (!["GET", "HEAD"].includes(request.method)) {
      if (request.headers.origin && request.headers.origin !== `${request.protocol}://${request.get("host")}`)
        return next(new AccountError("Anfrage von einer anderen Website abgelehnt.", 403));
      if (!request.is("application/json")) return next(new AccountError("JSON-Anfrage erforderlich.", 415));
    }
    next();
  });
  router.use(express.json({ limit: "4kb" }));
  router.use(async (request, response, next) => {
    try {
      response.locals.account = await store.session(sessionCookie(request.headers.cookie));
      next();
    } catch (error) { next(error); }
  });
  const requireLogin: express.RequestHandler = (_request, response, next) => {
    next(response.locals.account ? undefined : new AccountError("Bitte melde dich an.", 401));
  };
  const requireAdmin: express.RequestHandler = (_request, response, next) => {
    next(response.locals.account?.role === "admin" ? undefined : new AccountError("Nur Admins können Konten verwalten.", 403));
  };
  router.get("/me", (_request, response) => response.json({ account: response.locals.account ?? null }));
  for (const action of ["login", "register"] as const) {
    router.post(`/${action}`, async (request, response) => {
      if (!request.secure && !local(request)) throw new AccountError("Öffne die App über HTTPS, um dich anzumelden.", 400);
      const now = Date.now();
      for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
      const key = request.ip ?? "unknown";
      const limit = attempts.get(key) ?? { count: 0, until: now + 15 * 60000 };
      if (limit.count >= 20 || hashing >= 4 || (!attempts.has(key) && attempts.size >= 1000)) {
        response.setHeader("Retry-After", "900");
        throw new AccountError("Zu viele Anmeldeversuche. Bitte versuche es später erneut.", 429);
      }
      limit.count++; attempts.set(key, limit); hashing++;
      try {
        const body = request.body ?? {};
        const result = action === "login" ? await store.login(body.username, body.password)
          : await store.register(body.username, body.password, body.invitation);
        response.cookie(COOKIE, result.token, { httpOnly: true, secure: request.secure, sameSite: "strict", path: "/", maxAge: 30 * 86400000 });
        response.json({ account: result.account });
      } finally { hashing--; }
    });
  }
  router.post("/logout", requireLogin, async (request, response) => {
    await store.logout(sessionCookie(request.headers.cookie)!);
    onLogout(sessionCookie(request.headers.cookie)!);
    response.clearCookie(COOKIE, { httpOnly: true, secure: request.secure, sameSite: "strict", path: "/" });
    response.json({ ok: true });
  });
  router.put("/settings", requireLogin, async (request, response) => {
    const settings = await store.settings(response.locals.account.id, request.body);
    response.json({ account: { ...response.locals.account, settings } });
  });
  router.get("/statistics", requireLogin, async (_request, response) => {
    response.json({ statistics: await store.statistics(response.locals.account.id) });
  });
  router.get("/developer", requireLogin, (_request, response) => {
    if (!canDevelop(response.locals.account.role)) throw new AccountError("Der Proberaum ist nur für Entwickler und Admins verfügbar.", 403);
    response.json({ ok: true });
  });
  router.get("/users", requireAdmin, async (_request, response) => { response.json({ users: await store.list() }); });
  router.post("/invitations", requireAdmin, async (request, response) => {
    response.json({ invitation: await store.invite(request.body?.role) });
  });
  router.put("/users/:id/role", requireAdmin, async (request, response) => {
    await store.setRole(String(request.params.id), request.body?.role);
    response.json({ ok: true });
  });
  router.use((error: unknown, _request: Request, response: express.Response, _next: express.NextFunction) => {
    const status = error instanceof AccountError ? error.status : error instanceof SyntaxError ? 400 : 503;
    response.status(status).json({ error: error instanceof AccountError ? error.message : status === 400
      ? "Ungültige Anfrage." : "Kontospeicher nicht erreichbar. Bitte erneut versuchen." });
  });
  return router;
}
