import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const runtimeSource = await readFile(resolve(here, "../src/js/oracle-apex-echarts.js"), "utf8");
const compatibility = JSON.parse(await readFile(resolve(here, "../compatibility.json"), "utf8"));

export function createRuntimeHarness(specification) {
  const counters = {
    aborts: 0,
    creates: 0,
    disposes: 0,
    focusCalls: 0,
    initOptions: [],
    listeners: [],
    observersDisconnected: 0,
    regionCreates: 0,
    resizeCalls: 0
  };
  const chartByCanvas = new Map();
  const ajaxRequests = [];
  const dimensions = { width: 800, height: 320 };
  const documentListeners = new Map();
  const fallback = { hidden: true, textContent: "" };
  const mutationCallbacks = [];
  const resizeCallbacks = [];
  const regions = new Map();
  const media = { reducedMotion: false };
  const canvas = {
    attributes: { tabindex: "0" },
    style: {},
    focus() {
      counters.focusCalls += 1;
    },
    getBoundingClientRect() {
      return { ...dimensions };
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
  };
  const script = {
    id: `${specification.id}__spec`,
    type: "application/json",
    textContent: JSON.stringify(specification)
  };
  const host = {
    dataset: {
      oaeSpecId: script.id
    },
    dispatched: [],
    ownerDocument: null,
    style: {
      values: {},
      setProperty(name, value) {
        this.values[name] = value;
      }
    },
    contains(value) {
      return value === canvas || value === fallback;
    },
    dispatchEvent(event) {
      this.dispatched.push(event);
      return true;
    },
    matches(selector) {
      return selector === "[data-oracle-apex-echarts='1']";
    },
    querySelector(selector) {
      if (selector === ".oracle-apex-echarts__canvas") return canvas;
      if (selector === ".oracle-apex-echarts__fallback") return fallback;
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
  const document = {
    active: true,
    documentElement: {},
    readyState: "complete",
    addEventListener(name, callback) {
      counters.listeners.push(name);
      const callbacks = documentListeners.get(name) ?? [];
      callbacks.push(callback);
      documentListeners.set(name, callbacks);
    },
    contains(value) {
      return this.active && (value === host || value === canvas || value === fallback);
    },
    getElementById(id) {
      return id === script.id ? script : null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-oracle-apex-echarts='1']") {
        return this.active ? [host] : [];
      }
      return [];
    }
  };
  host.ownerDocument = document;

  class FakeChart {
    constructor() {
      this.handlers = new Map();
      this.options = [];
    }
    dispose() {
      counters.disposes += 1;
      chartByCanvas.delete(canvas);
    }
    clear() {}
    off(name) {
      this.handlers.delete(name);
    }
    on(name, callback) {
      this.handlers.set(name, callback);
    }
    resize() {
      counters.resizeCalls += 1;
    }
    setOption(option) {
      this.options.push(option);
    }
  }

  const echarts = {
    version: compatibility.echarts,
    getInstanceByDom(target) {
      return chartByCanvas.get(target) ?? null;
    },
    init(target, theme, options) {
      counters.creates += 1;
      counters.initOptions.push({ theme, options });
      const chart = new FakeChart();
      chartByCanvas.set(target, chart);
      return chart;
    },
    registerTheme() {}
  };

  function createAjaxRequest(...args) {
    let resolveRequest;
    let rejectRequest;
    const promise = new Promise((resolve, reject) => {
      resolveRequest = resolve;
      rejectRequest = reject;
    });
    promise.abort = () => {
      counters.aborts += 1;
    };
    ajaxRequests.push({ args, promise, resolve: resolveRequest, reject: rejectRequest });
    return promise;
  }

  const context = {
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    Intl,
    Map,
    MutationObserver: class MutationObserver {
      constructor(callback) {
        mutationCallbacks.push(callback);
      }
      disconnect() {}
      observe() {}
    },
    Object,
    Promise,
    ResizeObserver: class ResizeObserver {
      constructor(callback) {
        this.callback = callback;
        resizeCallbacks.push(callback);
      }
      disconnect() {
        counters.observersDisconnected += 1;
      }
      observe() {}
    },
    Set,
    TextEncoder,
    URL,
    apex: {
      debug: { info() {} },
      region: {
        create(id, api) {
          counters.regionCreates += 1;
          regions.set(id, api);
        },
        destroy(id) {
          regions.delete(id);
        }
      },
      server: {
        plugin: createAjaxRequest,
        process: createAjaxRequest
      }
    },
    console,
    document,
    echarts,
    globalThis: null,
    matchMedia(query) {
      return { matches: query === "(prefers-reduced-motion: reduce)" && media.reducedMotion };
    },
    module: { exports: {} },
    performance,
    requestAnimationFrame(callback) {
      callback();
    },
    setTimeout,
    window: null
  };
  context.globalThis = context;
  context.window = context;
  vm.runInNewContext(runtimeSource, context, { filename: "oracle-apex-echarts.js" });

  return {
    api: context.module.exports,
    ajaxRequests,
    canvas,
    chartByCanvas,
    context,
    counters,
    dimensions,
    document,
    fallback,
    host,
    media,
    regions,
    script,
    async triggerDocumentEvent(name, target = host) {
      await Promise.all((documentListeners.get(name) ?? []).map((callback) => callback({ target })));
    },
    triggerMutation() {
      mutationCallbacks.forEach((callback) => callback([]));
    },
    triggerResize() {
      resizeCallbacks.forEach((callback) => callback([]));
    },
    reloadRuntime() {
      vm.runInNewContext(runtimeSource, context, { filename: "oracle-apex-echarts.js" });
      return context.module.exports;
    }
  };
}
