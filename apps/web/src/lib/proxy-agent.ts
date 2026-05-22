import type { Storage } from "@mc-forgelab/storage";
import { getProxyRuntimeSettings, PROXY_SETTING_KEYS } from "../routes/proxy.js";

const ENV_KEYS = {
  http: "MC_FORGELAB_PROXY_HTTP",
  https: "MC_FORGELAB_PROXY_HTTPS",
  noProxy: "MC_FORGELAB_PROXY_NO_PROXY",
} as const;

function proxyUrl(address: string | undefined, port: number | undefined, username: string | undefined, password: string | undefined): string {
  const trimmed = address?.trim() ?? "";
  if (!trimmed) return "";
  const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`);
  if (port !== undefined) url.port = String(port);
  if (username) url.username = username;
  if (password) url.password = password;
  return url.toString();
}

function setOrDeleteEnv(key: string, value: string): void {
  if (value) process.env[key] = value;
  else delete process.env[key];
}

export function applyToolchainProxyEnv(storage: Storage): void {
  const proxy = getProxyRuntimeSettings({ storage });

  if (storage.getSetting(PROXY_SETTING_KEYS.http) !== undefined) {
    setOrDeleteEnv(ENV_KEYS.http, proxyUrl(proxy.http, proxy.httpPort, proxy.username, proxy.password));
  }

  if (storage.getSetting(PROXY_SETTING_KEYS.https) !== undefined) {
    setOrDeleteEnv(ENV_KEYS.https, proxyUrl(proxy.https, proxy.httpsPort, proxy.username, proxy.password));
  }

  if (storage.getSetting(PROXY_SETTING_KEYS.noProxy) !== undefined) {
    setOrDeleteEnv(ENV_KEYS.noProxy, proxy.noProxy?.trim() ?? "");
  }
}
