// A table is composed of rows and columns.
// Each column has a name, and a key.
// Each row has a cell for each column.

import chalk from "chalk";
import { LOG } from "./logs";

interface ITable {
  // key: name
  cols: Record<string, string>;
  // each element is key: value.
  rows: Record<string, any>[];
}

export const table = (data: ITable) => ({
  filter: {
    cols: (keys: string[]) => {
      return table({
        ...data,
        cols: Object.entries(data.cols)
          .filter(([key, val]) => keys.includes(key))
          .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {}),
      } as ITable);
    },
  },
  print: () => {
    const columnWidths: Record<string, number> = {};

    // Initialize with the names of each column for width.
    for (const [key, name] of Object.entries(data.cols)) {
      columnWidths[key] = name.length;
    }

    // Then, maximize.
    for (const row of data.rows) {
      for (const [key, value] of Object.entries(row)) {
        columnWidths[key] = Math.max(
          columnWidths[key],
          value.toString().length
        );
      }
    }

    // Print header
    LOG(
      chalk.bold(
        "|" +
          Object.entries(data.cols)
            .map(([key, name]) => name.padStart(columnWidths[key] + 1, " "))
            .join(" |") +
          " |"
      )
    );

    for (const row of data.rows) {
      LOG(
        "|" +
          Object.entries(row)
            .filter(([key, value]) => key in data.cols)
            .map(([key, value]) =>
              value.toString().padStart(columnWidths[key] + 1, " ")
            )
            .join(" |") +
          " |"
      );
    }
  },
});

interface IList {
  title: string;
  items: any[];
}
export const list = (data: IList) =>
  table({
    cols: { 0: data.title },
    rows: data.items.map((item) => ({ 0: item })),
  });
