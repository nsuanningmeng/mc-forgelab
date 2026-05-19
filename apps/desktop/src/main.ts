import { app, BrowserWindow, Menu, dialog, clipboard } from "electron";
import { buildApp } from "@mc-forgelab/web/server";
import { loadConfig } from "@mc-forgelab/config";
import { AppError } from "@mc-forgelab/app-error";

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
  const { app: fastify } = await buildApp({ cfg });
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
}

function formatStartupError(err: unknown): { message: string; detail: string; copyPayload: string } {
  if (err instanceof AppError) {
    const cause = err.cause instanceof Error ? err.cause : null;
    const detailLines = [
      err.messageEn,
      `Code: ${err.code}`,
      cause ? `Cause: ${cause.message}` : null,
      cause?.stack ? "" : null,
      cause?.stack ?? null
    ].filter((line): line is string => typeof line === "string");
    return {
      message: err.messageEn,
      detail: detailLines.slice(1).join("\n"),
      copyPayload: JSON.stringify(
        {
          code: err.code,
          messageEn: err.messageEn,
          messageZh: err.messageZh,
          httpStatus: err.httpStatus,
          cause: cause ? { message: cause.message, stack: cause.stack } : null,
        },
        null,
        2
      ),
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack ?? "" : "";
  return {
    message,
    detail: stack,
    copyPayload: JSON.stringify({ message, stack }, null, 2),
  };
}

app.whenReady().then(start).catch(async (err) => {
  const { message, detail, copyPayload } = formatStartupError(err);
  const { response } = await dialog.showMessageBox({
    type: "error",
    title: "MC ForgeLab — Startup Error",
    message,
    detail,
    buttons: ["Quit", "Copy details"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (response === 1) {
    try { clipboard.writeText(copyPayload); } catch { /* ignore */ }
  }
  app.quit();
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (!win) start(); });
