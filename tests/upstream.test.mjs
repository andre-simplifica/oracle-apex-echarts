import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createHash } from "node:crypto";
import { compareVersions, isStableVersion, parseSha512File, validateUpdateTarget, verifySri } from "../scripts/upstream.mjs";

describe("upstream safety", () => {
  test("accepts only explicit stable semantic versions", () => {
    assert.equal(isStableVersion("6.2.0"), true);
    for (const version of ["6.2", "6.2.0-rc.1", "7.0.0-beta.1", "nightly", "latest"]) assert.equal(isStableVersion(version), false);
  });

  test("compares stable versions without treating a downgrade as an update", () => {
    assert.ok(compareVersions("6.2.0", "6.1.9") > 0);
    assert.equal(compareVersions("6.1.0", "6.1.0"), 0);
    assert.ok(compareVersions("6.0.9", "6.1.0") < 0);
    assert.throws(() => compareVersions("7.0.0-rc.1", "6.1.0"));
  });

  test("blocks same-version and same-major downgrades before any download", () => {
    assert.deepEqual(validateUpdateTarget("6.1.0", "6.2.0"), { majorReview: false });
    assert.deepEqual(validateUpdateTarget("6.1.0", "7.0.0"), { majorReview: true });
    assert.throws(() => validateUpdateTarget("6.1.0", "6.0.9"), /downgrade/);
    assert.throws(() => validateUpdateTarget("6.1.0", "6.1.0"), /already vendored/);
    assert.throws(() => validateUpdateTarget("6.1.0", "7.0.0-rc.1"), /stable X\.Y\.Z/);
  });

  test("rejects a checksum entry that names another archive", () => {
    const digest = "a".repeat(128);
    assert.throws(() => parseSha512File(`${digest}  apache-echarts-6.1.0-rc.2-src.zip`, "apache-echarts-6.1.0-src.zip"), /candidate rejected/);
    assert.equal(parseSha512File(`${digest}  apache-echarts-6.2.0-src.zip`, "apache-echarts-6.2.0-src.zip"), digest);
  });

  test("verifies npm SHA-512 SRI and rejects modified bytes", () => {
    const bytes = Buffer.from("synthetic ECharts archive");
    const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
    assert.equal(verifySri(bytes, integrity), true);
    assert.throws(() => verifySri(Buffer.from("modified"), integrity), /verification failed/);
  });
});
