export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export function isJsonValue(value: unknown, ancestors = new WeakSet<object>()): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (ancestors.has(value)) return false;

  ancestors.add(value);
  let valid = false;

  if (Array.isArray(value)) {
    valid = value.every((item) => isJsonValue(item, ancestors));
  } else {
    const prototype = Object.getPrototypeOf(value);
    valid =
      (prototype === Object.prototype || prototype === null) &&
      Object.getOwnPropertySymbols(value).length === 0 &&
      Object.values(value).every((item) => isJsonValue(item, ancestors));
  }

  ancestors.delete(value);
  return valid;
}

export function assertJsonValue(value: unknown): asserts value is JsonValue {
  if (!isJsonValue(value)) {
    throw new TypeError('Protocol payload must be JSON-serializable data.');
  }
}
