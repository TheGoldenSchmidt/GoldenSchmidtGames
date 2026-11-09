import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** Run the real server entry point, crash it, then reuse its port and database. */
export async function restartFixture(options: { render?: boolean } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), "gsg-restart-"));
  let child: ChildProcess | undefined;
  let port = 0;
  async function start() {
    const env = { ...process.env, PORT: String(port), GSG_DATABASE_FILE: path.join(dir, "rooms.db").replaceAll("\\", "/"),
      TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "", RENDER: options.render ? "true" : "" };
    const proc = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
      env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true
    });
    child = proc;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Testserver startet nicht")), 20000);
      let output = "", errors = "";
      proc.stderr.on("data", chunk => { errors = (errors + chunk).slice(-2000); });
      proc.once("error", error => { clearTimeout(timer); reject(error); });
      proc.once("exit", code => { clearTimeout(timer); reject(new Error(`Testserver beendet (${code}): ${errors}`)); });
      proc.stdout.on("data", chunk => {
        output += chunk;
        const match = output.match(/http:\/\/localhost:(\d+)/);
        if (match) { port = Number(match[1]); clearTimeout(timer); resolve(); }
      });
    });
    return `http://127.0.0.1:${port}`;
  }
  async function crash() {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const ended = once(child, "exit");
    child.kill("SIGKILL");
    await ended;
    child = undefined;
  }
  return { start, crash, async close() { await crash(); await rm(dir, { recursive: true, force: true }); } };
}
