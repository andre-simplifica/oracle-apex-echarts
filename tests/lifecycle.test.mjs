import { describe, test } from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntimeHarness } from "./runtime-harness.mjs";
import { expect } from "./expect.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(await readFile(resolve(here, "fixtures/valid-chart-spec.json"), "utf8"));

describe("ciclo de vida", () => {
  test("deduplica bootstrap e inicialização, depois descarta a instância", async () => {
    const harness = createRuntimeHarness(fixture);
    harness.document.active = false;
    expect(harness.api.bootstrap()).toBeTrue();
    expect(harness.api.bootstrap()).toBeTrue();
    expect(harness.counters.listeners).toHaveLength(3);
    expect(harness.reloadRuntime()).toBe(harness.api);
    expect(harness.counters.listeners).toHaveLength(3);

    harness.document.active = true;
    await harness.api.scan();
    await harness.api.scan();
    expect(harness.counters.creates).toBe(1);
    expect(harness.api.registrySize()).toBe(1);
    expect(harness.host.style.values["--oae-min-height"]).toBe("320px");

    expect(harness.api.dispose(fixture.id, { destroyRegion: false })).toBeTrue();
    expect(harness.counters.disposes).toBe(1);
    expect(harness.counters.observersDisconnected).toBe(1);
    expect(harness.api.registrySize()).toBe(0);
  });

  test("registra a interface APEX mesmo quando o estado inicial está vazio", async () => {
    const emptySpec = structuredClone(fixture);
    emptySpec.integration = { regionId: "R_FIXTURE_VAZIA" };
    emptySpec.data.option.series = [];
    const harness = createRuntimeHarness(emptySpec);

    await harness.api.scan();
    expect(harness.counters.regionCreates).toBe(1);
    expect(harness.api.registrySize()).toBe(1);

    harness.api.dispose(emptySpec.id, { destroyRegion: false });
  });

  test("usa mensagens do profile quando o ChartSpec não define uma substituição", async () => {
    const emptySpec = structuredClone(fixture);
    delete emptySpec.accessibility.emptyText;
    emptySpec.data.option.series = [];
    const emptyHarness = createRuntimeHarness(emptySpec);
    emptyHarness.api.configure({
      projectProfile: {
        messages: {
          empty: "Mensagem vazia definida no profile.",
          error: "Mensagem de erro definida no profile."
        }
      }
    });

    expect(await emptyHarness.api.scan()).toEqual([true]);
    expect(emptyHarness.host.dataset.oaeState).toBe("empty");
    expect(emptyHarness.fallback.textContent).toBe("Mensagem vazia definida no profile.");
    emptyHarness.api.dispose(emptySpec.id, { destroyRegion: false });

    const invalidSpec = structuredClone(fixture);
    delete invalidSpec.accessibility.fallbackText;
    const errorHarness = createRuntimeHarness(invalidSpec);
    errorHarness.api.configure({
      projectProfile: { messages: { error: "Erro seguro definido no profile." } }
    });

    expect(await errorHarness.api.scan()).toEqual([false]);
    expect(errorHarness.host.dataset.oaeState).toBe("error");
    expect(errorHarness.fallback.textContent).toBe("Erro seguro definido no profile.");
  });

  test("rejeita payload acima do limite antes de criar uma instância ECharts", async () => {
    const oversizedSpec = structuredClone(fixture);
    oversizedSpec.data.option.series[0].data = Array.from({ length: 900 }, (_, index) => index);
    const harness = createRuntimeHarness(oversizedSpec);
    harness.api.configure({ projectProfile: { limits: { maxPayloadBytes: 4096 } } });

    expect(await harness.api.scan()).toEqual([false]);
    expect(harness.counters.creates).toBe(0);
    expect(harness.host.dataset.oaeState).toBe("error");
    expect(harness.fallback.textContent).toBe(oversizedSpec.accessibility.fallbackText);
  });

  test("aguarda região inicialmente oculta e renderiza quando ela se torna visível", async () => {
    const harness = createRuntimeHarness(fixture);
    harness.dimensions.width = 0;
    harness.dimensions.height = 0;

    expect(await harness.api.scan()).toEqual([false]);
    expect(harness.counters.creates).toBe(0);
    expect(harness.api.registrySize()).toBe(1);

    harness.api.bootstrap();
    harness.dimensions.width = 800;
    harness.dimensions.height = 320;
    await harness.triggerDocumentEvent("apexaftershow");
    expect(harness.counters.creates).toBe(1);
    expect(harness.host.dataset.oaeState).toBe("ready");

    harness.api.dispose(fixture.id, { destroyRegion: false });
  });

  test("reage a tabs, dialogs, fullscreen e resize sem recriar a instância", async () => {
    const harness = createRuntimeHarness(fixture);
    harness.api.bootstrap();
    await harness.api.scan();
    expect(harness.counters.creates).toBe(1);

    await harness.triggerDocumentEvent("apexaftershow");
    expect(harness.counters.creates).toBe(1);
    harness.dimensions.width = 1280;
    harness.dimensions.height = 640;
    harness.triggerResize();
    expect(harness.counters.resizeCalls).toBe(1);
    expect(harness.api.registrySize()).toBe(1);

    harness.api.dispose(fixture.id, { destroyRegion: false });
  });

  test("honra reduced motion, ARIA e foco de teclado da região APEX", async () => {
    const accessible = structuredClone(fixture);
    accessible.integration = { regionId: "R_ACCESSIBLE_FIXTURE" };
    const harness = createRuntimeHarness(accessible);
    harness.media.reducedMotion = true;

    await harness.api.scan();
    const chart = harness.chartByCanvas.get(harness.canvas);
    const option = chart.options.at(-1);
    expect(option.animation).toBeFalse();
    expect(option.animationDuration).toBe(0);
    expect(option.aria.enabled).toBeTrue();
    expect(harness.canvas.attributes.tabindex).toBe("0");
    expect(harness.canvas.attributes.role).toBe("img");
    expect(harness.canvas.attributes["aria-label"]).toBe(accessible.accessibility.description);
    harness.regions.get("R_ACCESSIBLE_FIXTURE").focus();
    expect(harness.counters.focusCalls).toBe(1);

    harness.api.dispose(accessible.id, { destroyRegion: false });
  });

  test("descarta host removido e permite reinseri-lo sem instância órfã", async () => {
    const harness = createRuntimeHarness(fixture);
    harness.api.bootstrap();
    await harness.api.scan();

    harness.document.active = false;
    harness.triggerMutation();
    expect(harness.api.registrySize()).toBe(0);
    expect(harness.counters.disposes).toBe(1);

    harness.document.active = true;
    await harness.api.scan();
    expect(harness.api.registrySize()).toBe(1);
    expect(harness.counters.creates).toBe(2);

    harness.api.dispose(fixture.id, { destroyRegion: false });
  });

  test("atualiza via callback do plugin após carga inicial inline", async () => {
    const inlinePluginSpec = structuredClone(fixture);
    inlinePluginSpec.integration = {
      regionId: "R_FIXTURE_INLINE",
      ajaxIdentifier: "AJAX_FIXO",
      itemsToSubmit: ["P1_FILTER_FIXTURE"]
    };
    const harness = createRuntimeHarness(inlinePluginSpec);

    await harness.api.scan();
    expect(harness.ajaxRequests).toHaveLength(0);
    const refresh = harness.api.refresh(inlinePluginSpec.id);
    expect(harness.ajaxRequests).toHaveLength(1);
    harness.ajaxRequests[0].resolve({ chartSpec: fixture });
    expect(await refresh).toBeTrue();
    expect(harness.counters.creates).toBe(1);

    harness.api.dispose(inlinePluginSpec.id, { destroyRegion: false });
  });

  test("cria e descarta dez ciclos sem acumular instâncias ou observers", async () => {
    const harness = createRuntimeHarness(fixture);
    for (let cycle = 0; cycle < 10; cycle += 1) {
      await harness.api.scan();
      expect(harness.api.registrySize()).toBe(1);
      expect(harness.api.dispose(fixture.id, { destroyRegion: false })).toBeTrue();
    }
    expect(harness.counters.creates).toBe(10);
    expect(harness.counters.disposes).toBe(10);
    expect(harness.counters.observersDisconnected).toBe(10);
    expect(harness.api.registrySize()).toBe(0);
  });

  test("cancela requisição AJAX anterior e ignora o ciclo obsoleto", async () => {
    const ajaxSpec = structuredClone(fixture);
    ajaxSpec.integration = { regionId: "R_GRAFICO_TESTE", ajaxIdentifier: "AJAX_FIXO" };
    ajaxSpec.data = {
      mode: "ajax",
      contract: "option",
      ajax: {
        transport: "apexPlugin",
        itemsToSubmit: ["P1_FILTER_FIXTURE"],
        responseGroup: "fixture"
      }
    };
    const harness = createRuntimeHarness(ajaxSpec);
    const firstScan = harness.api.scan();
    await Promise.resolve();
    expect(harness.ajaxRequests[0].args[2].refreshObject).toBeUndefined();
    expect(harness.ajaxRequests[0].args[2].loadingIndicator).toBe(harness.canvas);
    const latestRefresh = harness.api.refresh(ajaxSpec.id);
    expect(harness.counters.aborts).toBe(1);
    expect(harness.ajaxRequests).toHaveLength(2);

    harness.ajaxRequests[1].resolve({ chartSpec: fixture });
    await latestRefresh;
    expect(harness.counters.creates).toBe(1);
    expect(harness.api.registrySize()).toBe(1);

    harness.ajaxRequests[0].resolve({ chartSpec: fixture });
    expect(await firstScan).toEqual([false]);
    expect(harness.counters.creates).toBe(1);

    const nextRefresh = harness.api.refresh(ajaxSpec.id);
    expect(harness.ajaxRequests).toHaveLength(3);
    harness.ajaxRequests[2].resolve({ chartSpec: fixture });
    await nextRefresh;
    expect(harness.counters.creates).toBe(1);

    harness.api.dispose(ajaxSpec.id, { destroyRegion: false });
  });

  test("ignora a rejeição de uma requisição AJAX já substituída", async () => {
    const ajaxSpec = structuredClone(fixture);
    ajaxSpec.integration = { regionId: "R_AJAX_ABORT", ajaxIdentifier: "AJAX_FIXO" };
    ajaxSpec.data = {
      mode: "ajax",
      contract: "option",
      ajax: { transport: "apexPlugin", responseGroup: "fixture" }
    };
    const harness = createRuntimeHarness(ajaxSpec);
    const firstScan = harness.api.scan();
    await Promise.resolve();
    const latestRefresh = harness.api.refresh(ajaxSpec.id);

    harness.ajaxRequests[0].reject(new Error("abort"));
    harness.ajaxRequests[1].resolve({ chartSpec: fixture });
    expect(await firstScan).toEqual([false]);
    expect(await latestRefresh).toBeTrue();
    expect(harness.fallback.hidden).toBeTrue();

    harness.api.dispose(ajaxSpec.id, { destroyRegion: false });
  });

  test("encerra refresh AJAX com erro sanitizado e permite recuperar", async () => {
    const inlinePluginSpec = structuredClone(fixture);
    inlinePluginSpec.integration = {
      regionId: "R_AJAX_ERRO",
      ajaxIdentifier: "AJAX_FIXO"
    };
    const harness = createRuntimeHarness(inlinePluginSpec);

    await harness.api.scan();
    const failedRefresh = harness.api.refresh(inlinePluginSpec.id);
    harness.ajaxRequests[0].resolve({
      chartError: true,
      message: "ORA-20999: detalhe técnico que não pode chegar à interface"
    });

    expect(await failedRefresh).toBeFalse();
    expect(harness.host.dataset.oaeState).toBe("error");
    expect(harness.fallback.hidden).toBeFalse();
    expect(harness.fallback.textContent).toBe(fixture.accessibility.fallbackText);
    expect(harness.fallback.textContent).not.toContain("ORA-");

    const recoveredRefresh = harness.api.refresh(inlinePluginSpec.id);
    harness.ajaxRequests[1].resolve({ chartSpec: fixture });
    expect(await recoveredRefresh).toBeTrue();
    expect(harness.host.dataset.oaeState).toBe("ready");
    expect(harness.fallback.hidden).toBeTrue();

    harness.api.dispose(inlinePluginSpec.id, { destroyRegion: false });
  });
});
