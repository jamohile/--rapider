import fs from "fs";
import path from "path";
import util from "util";

const access = util.promisify(fs.access);

type FlagVals = Record<string, any>;

export interface IFlagRule<K> {
  check: (data: K) => Promise<boolean>;
  message: () => Promise<string>;
}

type ValFromFlags<T> = (flags: FlagVals) => T | Promise<T>;

export interface IFlagRules {
  oneOf: <T>(allowed: ValFromFlags<T[]>) => (flags: FlagVals) => IFlagRule<T>;
  allOneOf: <T>(
    allowed: ValFromFlags<T[]>
  ) => (flags: FlagVals) => IFlagRule<T[]>;

  notPartOf: <T>(
    disallowed: ValFromFlags<T[]>
  ) => (flags: FlagVals) => IFlagRule<T>;
  noneArePartOf: <T>(
    disallowed: ValFromFlags<T[]>
  ) => (flags: FlagVals) => IFlagRule<T[]>;

  unique: <K>() => (flags: FlagVals) => IFlagRule<K[]>;
  length: <K>(
    length: ValFromFlags<number>
  ) => (flags: FlagVals) => IFlagRule<K>;
  required: <K>() => (flags: FlagVals) => IFlagRule<K>;

  greaterThan: <K>(value: ValFromFlags<K>) => (flags: FlagVals) => IFlagRule<K>;
  lessThan: <K>(value: ValFromFlags<K>) => (flags: FlagVals) => IFlagRule<K>;
  positive: <K>() => (flags: FlagVals) => IFlagRule<K>;
  negative: <K>() => (flags: FlagVals) => IFlagRule<K>;

  pathExists: (args: { parent?: boolean }) => () => IFlagRule<string>;

  custom: <K>(
    handler: (data?: K, flags?: FlagVals) => boolean | Promise<boolean>
  ) => (flags: FlagVals) => IFlagRule<K>;
}

export const FlagRules: IFlagRules = {
  oneOf: (allowed) => (flags) => ({
    check: async (data) =>
      data === undefined || (await allowed(flags)).includes(data),
    message: async () => "Must be one of " + (await allowed(flags)).join(", "),
  }),
  allOneOf: (allowed) => (flags) => ({
    check: async (data) =>
      data === undefined ||
      (
        await Promise.all(
          data.map(async (e) => (await allowed(flags)).includes(e))
        )
      ).every((p) => p),
    message: async () =>
      "All must be one of " + (await allowed(flags)).join(", "),
  }),
  notPartOf: (disallowed) => (flags) => ({
    check: async (data) =>
      data === undefined || !(await disallowed(flags)).includes(data),
    message: async () =>
      "Must not be part of " + (await disallowed(flags)).join(", "),
  }),
  noneArePartOf: (disallowed) => (flags) => ({
    check: async (data) =>
      data === undefined ||
      !data.some(async (e) => (await disallowed(flags)).includes(e)),
    message: async () =>
      "None must be part of " + (await disallowed(flags)).join(", "),
  }),
  unique: () => () => ({
    check: async (data) => {
      if (data === undefined) {
        return true;
      }
      const seen = new Set();
      for (const d of data) {
        if (seen.has(d)) {
          return false;
        } else {
          seen.add(d);
        }
      }
      return true;
    },
    message: async () => "Elements must be unique.",
  }),
  length: (length) => (flags) => ({
    check: async (data: any) =>
      data === undefined || data.length === (await length(flags)),
    message: async () => `Must have length ${await length(flags)}.`,
  }),
  required: () => () => ({
    check: async (data: any) => data !== undefined,
    message: async () => "Must be supplied.",
  }),
  greaterThan: (val) => (flags) => ({
    check: async (data) => data === undefined || data > (await val(flags)),
    message: async () => `Must be greater than ${await val(flags)}`,
  }),
  lessThan: (val) => (flags) => ({
    check: async (data) => data === undefined || data < (await val(flags)),
    message: async () => `Must be less than ${await val(flags)}`,
  }),
  positive: () => FlagRules.greaterThan(() => 0 as any),
  negative: () => FlagRules.lessThan(() => 0 as any),

  pathExists:
    ({ parent = false }) =>
    () => ({
      check: async (_path) => {
        if (_path === undefined) {
          return true;
        }
        const checkPath = parent ? path.dirname(_path) : _path;
        try {
          await access(checkPath);
          return true;
        } catch {
          return false;
        }
      },
      message: async () => "Path must exist.",
    }),

  custom: (handler) => (flags) => ({
    check: async (data) => {
      return (data === undefined) || await handler(data, flags);
    },
    message: async () => "Custom Flag Rule",
  }),
};
