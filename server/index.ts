import express from "express";
import { RoomStore, deploymentDatabase } from "./roomStore";
import { createRoomCore } from "../shared/roomCore";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Server } from "socket.io";
import { accountRoutes, sessionCookie } from "./accountRoutes";
import { hashToken } from "./accountStore";
export function createSpielraumServer(store = new RoomStore({ url: ":memory:" })) {
  const app = express();
  app.set("trust proxy", 1);
  app.use((request, response, next) => {
    response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    response.setHeader("Referrer-Policy", "same-origin");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("X-Robots-Tag", "noindex, nofollow");
    if (request.secure) response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  });
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true }
  });
  app.use("/api/account", accountRoutes(store.accounts, token => {
    for (const socket of io.sockets.sockets.values()) if (socket.data.sessionHash === hashToken(token)) socket.disconnect(true);
  }));
  io.use(async (socket, next) => {
    try {
      const token = sessionCookie(socket.request.headers.cookie);
      const account = await store.accounts.session(token);
      socket.data.accountId = account?.id;
      socket.data.sessionHash = token ? hashToken(token) : undefined;
      socket.use((packet, proceed) => {
        const [event, payload] = packet;
        if (["room:create", "room:join", "party:test-create"].includes(event) &&
          typeof payload?.playerId === "string" && payload.playerId.trim().startsWith("acct_") &&
          payload.playerId.trim() !== socket.data.accountId) {
          const reply = packet.at(-1);
          if (typeof reply === "function") reply({ ok: false, error: "Bitte melde dich mit diesem Konto an." });
          return;
        }
        proceed();
      });
      next();
    } catch { next(new Error("Kontospeicher nicht erreichbar.")); }
  });

  const core = createRoomCore({
    onPeer: listener => { io.on("connection", listener); },
    peer: id => io.sockets.sockets.get(id),
    members: group => io.sockets.adapter.rooms.get(group),
    emitTo: (groups, event, payload) => { io.to(groups).emit(event, payload); },
    clearGroup: group => io.in(group).socketsLeave(group),
    dropConnections: () => { for (const peer of io.sockets.sockets.values()) peer.conn.close(); }
  }, store);
  io.use((_socket, next) => next(core.available ? undefined : new Error("Spielstände werden geladen.")));

app.get("/api/health", (_request, response) => {
  response.status(core.available ? 200 : 503).json({ ok: core.available, version: "0.1.0", rooms: core.count });
});

const distDirectory = path.resolve(process.cwd(), "dist");
if (existsSync(distDirectory)) {
  app.use(express.static(distDirectory, {
    maxAge: "1h",
    setHeaders(response, filePath) {
      if (filePath.endsWith("sw.js") || filePath.endsWith("manifest.webmanifest") || filePath.endsWith("index.html")) {
        response.setHeader("Cache-Control", "no-cache");
      } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    }
  }));
  app.use((request, response, next) => {
    if (request.method !== "GET" || !request.accepts("html")) return next();
    response.setHeader("Cache-Control", "no-cache");
    response.sendFile(path.join(distDirectory, "index.html"));
  });
}

  return {
    app,
    httpServer,
    async listen(port: number) {
      // Claim the database only after reserving the port. A failed second
      // local launch must not revoke the running server's write access.
      const bound = await new Promise<number>((resolve, reject) => {
        httpServer.once("error", reject);
        httpServer.listen(port, () => {
          httpServer.off("error", reject);
          resolve((httpServer.address() as AddressInfo).port);
        });
      });
      try {
        await store.accounts.initialize(process.env.GSG_ADMIN_INVITE);
        await core.start();
        return bound;
      } catch (error) {
        await this.close();
        throw error;
      }
    },
    async close() {
      const stopping = core.stop();
      await new Promise<void>(resolve => io.close(() => resolve()));
      await stopping;
    }
  };
}

const isMainModule = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "");

if (isMainModule) {
  const server = createSpielraumServer(new RoomStore(deploymentDatabase()));
  const port = Number(process.env.PORT ?? 3001);
  server.listen(port).then(boundPort => {
    console.log(`GoldenSchmidtGames-Server läuft auf http://localhost:${boundPort}`);
    const stop = () => { void server.close(); };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
  }).catch(() => {
    console.error("Start fehlgeschlagen. Port, Datenbankzugang und Spielstandformat prüfen.");
    process.exitCode = 1;
  });
}
