#!/usr/bin/env ts-node -T

import * as rapider from "../src";

async function main() {
  const store = await rapider.store.register("todo-table-block-whisper");

  enum TodoStatus {
    TODO = "todo",
    ACTIVE = "active",
    DONE = "done",
  }

  interface ITodo {
    id: string;
    description: string;
    status: TodoStatus;
  }

  const cli: rapider.ICli = {
    scopes: {
      add: {
        flags: {
          positional: [
            {
              key: "id",
              description: "Unique id name for todo.",
              type: rapider.flags.types.string(),
              rules: [
                rapider.flags.rules.required(),
                rapider.flags.rules.custom(
                  (data) => data === data.toLowerCase()
                ),
                rapider.flags.rules.notPartOf(async () =>
                  (await store.get<ITodo[]>("todos", []))!.map((t) => t.id)
                ),
              ],
            },
          ],
          named: [
            {
              key: "description",
              aliases: ["d"],
              type: rapider.flags.types.string(),
              default: "",
            },
          ],
        },
        handler: async (flags) => {
          await store.append("todos", [
            {
              id: flags.id,
              description: flags.description,
              status: TodoStatus.ACTIVE,
            },
          ]);
          rapider.ui.logs.SUCCESS("Added new todo.");
        },
      },
      view: {
        handler: async () => {
          const todos = (await store.get<ITodo[]>("todos", [])) as ITodo[];
          rapider.ui.data
            .table({
              cols: { id: "ID", description: "Description", status: "Status" },
              rows: todos,
            })
            .print();
        },
      },
      edit: {
        flags: {
          positional: [
            {
              key: "id",
              type: rapider.flags.types.string(),
              rules: [
                rapider.flags.rules.required(),
                rapider.flags.rules.oneOf(async () =>
                  (await store.get<ITodo[]>("todos", []))!.map((t) => t.id)
                ),
              ],
            },
          ],
          named: [
            {
              key: "description",
              aliases: ["d"],
              type: rapider.flags.types.string(),
            },
            {
              key: "status",
              aliases: ["s"],
              type: rapider.flags.types.string(),
              rules: [
                rapider.flags.rules.oneOf(() => Object.values(TodoStatus)),
              ],
            },
          ],
        },
        handler: async (flags) => {
          await store.updateElement<ITodo>(
            "todos",
            (todo) => todo.id === flags.id,
            (todo) => ({
              ...todo,
              description: flags.description || todo.description,
              status: flags.status || todo.status, 
            })
          );
          rapider.ui.logs.SUCCESS("Edited todo.");
        },
      },
      delete: {
        flags: {
          positional: [
            {
              key: "id",
              type: rapider.flags.types.string(),
              rules: [
                rapider.flags.rules.required(),
                rapider.flags.rules.oneOf(async () =>
                  (await store.get<ITodo[]>("todos", []))!.map((t) => t.id)
                ),
              ],
            },
          ],
        },
        handler: async (flags) => {
          await store.deleteElement<ITodo>(
            "todos",
            (todo) => todo.id === flags.id
          );
          rapider.ui.logs.SUCCESS("Deleted todo.");
        },
      },
    },
  };
  rapider.run(cli);
}
main();
