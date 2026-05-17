#!/usr/bin/env node
// Bin shim: keep small; entire CLI logic lives in dist/main.js.
import { runCli } from "../dist/main.js";

runCli(process.argv, process.env)
  .then((code) => {
    process.exit(code);
  })
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e?.stack ?? e);
    process.exit(1);
  });
