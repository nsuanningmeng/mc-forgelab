import { app, BrowserWindow } from "electron";
import { buildApp } from "@mc-forgelab/web/server";
import { loadConfig } from "@mc-forgelab/config";

let win: BrowserWindow | null = null;

async function start() {
  const cfg = loadConfig({ mode: "desktop" });
  const { app: fastify } = await buildApp();
  const address = await fastify.listen({ port: 0, host: "127.0.0.1" });
  const port = new URL(address).port;

  win = new BrowserWindow({ width: 1280, height: 800, webPreferences: { nodeIntegration: false, contextIsolation: true } });
  win.loadURL(`http://127.0.0.1:${port}`);
  win.on("closed", () => { win = null; fastify.close(); });
  void cfg;
}

app.whenReady().then(start);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (!win) start(); });
