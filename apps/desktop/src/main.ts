import { app, BrowserWindow, Menu, dialog } from "electron";
import { buildApp } from "@mc-forgelab/web/server";
import { loadConfig } from "@mc-forgelab/config";

// Hide the default Electron menu bar (File / Edit / View / Window / Help) on
// Windows/Linux where it sits inside the window chrome, is English-only, and
// clashes with the dark workbench UI. On macOS we KEEP the native app menu —
// removing it would break OS conventions (Quit / Hide / Services etc.).
if (process.platform !== "darwin") {
  Menu.setApplicationMenu(null);
}

let win: BrowserWindow | null = null;

async function start() {
  const cfg = loadConfig({ mode: "desktop" });
  const { app: fastify } = await buildApp();
  await fastify.listen({ port: 0, host: "127.0.0.1" });
  const addr = fastify.server.address();
  const port = typeof addr === "object" && addr ? addr.port : 3000;

  win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: process.platform !== "darwin",
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  if (process.platform !== "darwin") {
    win.setMenuBarVisibility(false);
    win.removeMenu();
  }
  win.webContents.on("did-fail-load", (_e, code, desc) => {
    dialog.showErrorBox("Load Error", `${desc} (${code})`);
  });
  win.loadURL(`http://127.0.0.1:${port}`);
  win.on("closed", () => { win = null; fastify.close(); });
  void cfg;
}

app.whenReady().then(start).catch((err) => {
  dialog.showErrorBox("Startup Error", String(err));
  app.quit();
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (!win) start(); });
