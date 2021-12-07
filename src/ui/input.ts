// Enable interactive input.
import chalk from "chalk";
import readline from "readline";
import { ui } from "..";
import { LOG } from "./logs";
import { clearNLines } from "./utils";
readline.emitKeypressEvents(process.stdin);

type ListItem = { value: any; display: string };

// A list input that lets us select items in a fancy arrow-key list.
// We return a list to allow for multi selection.
interface IListInput {
  items: ListItem[];
  multiple: boolean;
}

export function list(args: IListInput): Promise<any[]> {
  const selection = new Set();
  let cursor = 0;

  process.stdin.setRawMode(true);

  ui.logs.LOG(
    "Use up/down to navigate, space to toggle, enter to confirm, ctrl-c to cancel."
  );

  const items = args.items.map((item, i) =>
    LOG(getItemText(item, false, i == 0))
  );

  return new Promise((resolve, reject) => {
    const stream = process.stdin.on("keypress", (str, key) => {
      switch (key.name) {
        case "return": {
          process.stdin.setRawMode(false);
          stream.destroy();
          resolve(Array.from(selection.values()));
          return;
        }
        case "up": {
          cursor = Math.max(cursor - 1, 0);
          break;
        }
        case "down": {
          cursor = Math.min(cursor + 1, args.items.length - 1);
          break;
        }
        case "space": {
          const selectedItem = args.items[cursor];

          if (args.multiple === false) {
            selection.clear();
          }

          if (selection.has(selectedItem.value)) {
            selection.delete(selectedItem.value);
          } else {
            selection.add(selectedItem.value);
          }
          break;
        }
        case "c": {
          if (key.ctrl) {
            process.exit();
          }
        }
      }
      args.items.forEach((item, i) =>
        items[i].refresh(
          getItemText(item, selection.has(item.value), i === cursor)
        )
      );
    });
  });
}

function getItemText(item: ListItem, selected: boolean, cursor: boolean) {
  return `${cursor ? ">" : " "} ${selected ? chalk.green("[✓]") : "[ ]"} ${
    item.display
  }`;
}

// Test List
// 
// list({
//   items: [
//     { value: "a", display: "Apple" },
//     { value: "b", display: "Berry" },
//     { value: "c", display: "Carrot" },
//   ],
//   multiple: true
// });
