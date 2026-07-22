import assert from "node:assert/strict";

function comparable(value) {
  if (Array.isArray(value)) return Array.from(value, comparable);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, comparable(child)]));
  }
  return value;
}

function matcher(actual, inverted) {
  const run = (callback) => inverted ? assert.throws(callback) : callback();
  return {
    toBe(expected) { run(() => assert.strictEqual(actual, expected)); },
    toEqual(expected) { run(() => assert.deepStrictEqual(comparable(actual), comparable(expected))); },
    toContain(expected) { run(() => assert.ok(actual.includes(expected), `${actual} does not contain ${expected}`)); },
    toMatch(expected) { run(() => assert.match(actual, expected)); },
    toHaveLength(expected) { run(() => assert.strictEqual(actual.length, expected)); },
    toBeTrue() { run(() => assert.strictEqual(actual, true)); },
    toBeFalse() { run(() => assert.strictEqual(actual, false)); },
    toBeUndefined() { run(() => assert.strictEqual(actual, undefined)); },
    toBeNull() { run(() => assert.strictEqual(actual, null)); },
    toThrow(expected) {
      if (inverted) {
        assert.doesNotThrow(actual);
      } else if (expected instanceof RegExp) {
        assert.throws(actual, expected);
      } else if (typeof expected === "string") {
        assert.throws(actual, (error) => String(error.message).includes(expected));
      } else {
        assert.throws(actual);
      }
    }
  };
}

export function expect(actual) {
  const positive = matcher(actual, false);
  Object.defineProperty(positive, "not", { get: () => matcher(actual, true) });
  return positive;
}
