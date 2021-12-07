import { IFlagType } from "./types";
import { IFlagRule } from "./rules";

export interface IFlag<K> {
  key: string;
  type: IFlagType<K>;

  default?: K;

  // An optional description, this will be used to explain the flag to the user.
  description?: string;

  // Note that the rules for a single flag,
  // Are a function of all flags. This allows dependent rules.
  // For example, given to date flags (from, to), we could enforce to > from.
  rules?: ((flags: Record<string, any>) => IFlagRule<K>)[];
}

export interface INamedFlag<K> extends IFlag<K> {
  aliases?: string[];
}

export interface IPositionalFlag<K> extends IFlag<K> {}
