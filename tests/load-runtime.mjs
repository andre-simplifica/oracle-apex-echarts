import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const runtimeSource = await readFile(resolve(here, "../src/js/oracle-apex-echarts.js"), "utf8");

export function loadRuntime() {
  const context = {
    Intl,
    Map,
    Object,
    Set,
    TextEncoder,
    URL,
    console,
    globalThis: null,
    matchMedia() {
      return { matches: false };
    },
    module: { exports: {} },
    performance,
    window: null
  };
  context.globalThis = context;
  context.window = context;
  vm.runInNewContext(runtimeSource, context, { filename: "oracle-apex-echarts.js" });
  return context.module.exports;
}
