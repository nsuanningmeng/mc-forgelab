import { app, BrowserWindow, Menu, dialog, clipboard } from "electron";
import electronUpdater from "electron-updater";
const { autoUpdater } = electronUpdater;
import { buildApp } from "@mc-forgelab/web/server";
import { loadConfig } from "@mc-forgelab/config";
import { AppError } from "@mc-forgelab/app-error";
import { createLogger } from "@mc-forgelab/logger";

const log = createLogger({ context: { app: "desktop" } });
const isHeadless = process.argv.includes("--headless") || process.env.MC_FORGELAB_HEADLESS === "1";
const SHUTDOWN_TIMEOUT_MS = 5_000;

// Hide the default Electron menu bar (File / Edit / View / Window / Help) on
// Windows/Linux where it sits inside the window chrome, is English-only, and
// clashes with the dark workbench UI. On macOS we KEEP the native app menu —
// removing it would break OS conventions (Quit / Hide / Services etc.).
if (process.platform !== "darwin") {
  Menu.setApplicationMenu(null);
}

type BuiltApp = Awaited<ReturnType<typeof buildApp>>;

let win: BrowserWindow | null = null;
let fastify: BuiltApp["app"] | null = null;
let storage: BuiltApp["storage"] | null = null;
let serverUrl: string | null = null;
let shutdownStarted = false;
let shutdownComplete = false;
let updateCheckStarted = false;

async function start() {
  if (fastify && serverUrl) {
    if (!isHeadless && !win) createWindow(serverUrl);
    return;
  }

  const cfg = loadConfig({ mode: "desktop" });
  const built = await buildApp({ cfg });
  fastify = built.app;
  storage = built.storage;
  await fastify.listen({ port: 0, host: "127.0.0.1" });
  const addr = fastify.server.address();
  const port = typeof addr === "object" && addr ? addr.port : 3000;
  serverUrl = `http://127.0.0.1:${port}`;

  console.log(JSON.stringify({ port, url: serverUrl }));

  checkForUpdates();
  if (isHeadless) return;

  createWindow(serverUrl);
}

function createWindow(url: string): void {
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
  win.loadURL(url);
  win.on("closed", () => { win = null; });
}

function checkForUpdates(): void {
  if (isHeadless || updateCheckStarted || !app.isPackaged) return;
  updateCheckStarted = true;
  autoUpdater.on("error", (err) => {
    log.warn("Electron auto-update error", { error: err instanceof Error ? err.message : String(err) });
  });
  try {
    void autoUpdater.checkForUpdatesAndNotify().catch((err: unknown) => {
      log.warn("Electron auto-update check failed", { error: err instanceof Error ? err.message : String(err) });
    });
  } catch (err) {
    log.warn("Electron auto-update check failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

async function withShutdownTimeout(label: string, close: () => void | Promise<void>): Promise<void> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<"timeout">((resolve) => {
    timeout = setTimeout(() => {
      log.warn(`${label} shutdown timed out`, { timeoutMs: SHUTDOWN_TIMEOUT_MS });
      resolve("timeout");
    }, SHUTDOWN_TIMEOUT_MS);
  });

  try {
    await Promise.race([Promise.resolve().then(close), timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function closeRuntime(): Promise<void> {
  const appToClose = fastify;
  fastify = null;
  if (appToClose) {
    try {
      await withShutdownTimeout("Fastify", () => appToClose.close());
    } catch (err) {
      log.error("Fastify shutdown failed", err instanceof Error ? err : new Error(String(err)));
    }
  }

  const storageToClose = storage;
  storage = null;
  if (storageToClose) {
    try {
      await withShutdownTimeout("Storage", () => storageToClose.close());
    } catch (err) {
      log.error("Storage shutdown failed", err instanceof Error ? err : new Error(String(err)));
    }
  }
}

async function shutdownAndExit(code = 0): Promise<void> {
  if (shutdownStarted) return;
  shutdownStarted = true;
  await closeRuntime();
  shutdownComplete = true;
  app.exit(code);
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
  if (isHeadless) {
    log.error("Desktop startup failed", err instanceof Error ? err : new Error(String(err)));
    await shutdownAndExit(1);
    return;
  }

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
  await shutdownAndExit(1);
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (!win) void start(); });
app.on("before-quit", (event) => {
  if (shutdownComplete) return;
  event.preventDefault();
  void shutdownAndExit(0);
});
