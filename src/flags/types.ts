import path from "path";

import { ICli } from "..";
import { ERROR } from "../ui/logs";

export interface IFlagType<T> {
  length: number;
  parse: (data: string[]) => T;

  default?: any;

  name: string;
}

interface IFlagTypes {
  string: () => IFlagType<string>;
  int: () => IFlagType<bigint>;
  float: () => IFlagType<number>;

  presence: () => IFlagType<boolean>;

  list: <L>(args: IListFlagArgs<L>) => IFlagType<L[]>;
  date: () => IFlagType<Date>;
  json: <T>() => IFlagType<T>;
  path: () => IFlagType<string>;
}

interface IListFlagArgs<L> {
  separator?: string;
  type?: IFlagType<L>;
}

export const FlagTypes: IFlagTypes = {
  string: () => ({
    length: 1,
    parse: (data) => data[0],
    name: "STRING",
  }),
  int: () => ({
    length: 1,
    parse: (data) => parseInt(data[0]) as unknown as bigint,
    name: "INT",
  }),
  float: () => ({
    length: 1,
    parse: (data) => parseFloat(data[0]),
    name: "FLOAT",
  }),
  presence: () => ({
    length: 0,
    parse: () => true,
    default: undefined,
    name: "PRESENCE",
  }),
  list: <L>({
    separator = ",",
    //@ts-ignore
    type = FlagTypes.string(),
  }: IListFlagArgs<L>) => ({
    length: 1,
    parse: (data) => data[0].split(separator).map((item) => type.parse([item])),
    default: [],
    name: `LIST[${type.name}]`,
  }),
  date: () => ({
    length: 1,
    parse: (data) => {
      const [y, m, d] = data[0].split("-").map((s) => parseInt(s, 10));
      return new Date(y, m - 1 || 0, d || 1, 0, 0, 0, 0);
    },
    name: "DATE(yyyy-mm-dd)",
  }),

  json: () => ({
    length: 1,
    parse: (data) => {
      try {
        return JSON.parse(data[0]);
      } catch {
        ERROR("Invalid JSON.");
      }
    },
    name: "JSON",
  }),
  path: () => ({
    length: 1,
    parse: (data) =>
      path.normalize(
        path.isAbsolute(data[0]) ? data[0] : path.join(process.cwd(), data[0])
      ),
    name: "FILE",
  }),
};
