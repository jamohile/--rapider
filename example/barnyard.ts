#!/usr/bin/env ts-node -T

import * as rapider from "../src";

// We have a simple CLI here. It should let us perform the following ops.
// - list animals in the barn
// - add animal with name and type to barn
// - build one of the two following:
//     - pen, where we need to know size in # animals
//     - house, where we need to know # rooms.

async function main() {
  const store = rapider.store.create("barnyard-blueberry-grapefruit-chair")
  await store.register();

  const cli: rapider.ICli = {
    name: "Barnyard",
    description: "Tools for managing a barnyard.",
    scopes: {
      list: {
        name: "List",
        description: "List animals in the barnyard.",
        flags: {
          named: [
            {
              key: "fields",
              type: rapider.flags.types.list({
                type: rapider.flags.types.string(),
              }),
              rules: [rapider.flags.rules.allOneOf(() => ["id", "name"])],
              default: ["id", "name"],
            },
          ],
        },
        handler: async (args) => {
          const animals = (await store.get("animals") as []) || [];

          rapider.ui.data
            .table({
              cols: { id: "ID", name: "Animal" },
              rows: animals,
            })
            .filter.cols(args.fields)
            .print();
        },
      },
      remove: {
        name: "Remove",
        description: "Remove animals from the barnyard.",
        handler: async () => {
          const animals = await store.get("animals");
          const removedAnimals = await rapider.ui.input.list({
            items: (animals as []).map((a: { id: string; name: string }) => ({
              value: a.id,
              display: a.name,
            })),
            multiple: true,
          });
          await store.set(
            "animals",
            (animals as []).filter(
              (a: { id: string }) => !removedAnimals.includes(a.id)
            )
          );
          rapider.ui.logs.SUCCESS("Done.");
        },
      },
      add: {
        name: "Add",
        description: "Add animal to the barnyard.",
        flags: {
          named: [
            {
              key: "name",
              type: rapider.flags.types.string(),
              aliases: ["n"],
              rules: [
                rapider.flags.rules.required(),
                rapider.flags.rules.notPartOf(async () => {
                  return ((await store.get("animals") as []) || []).map(
                    (a: { name: string }) => a.name
                  );
                }),
              ],
              prompt: true
            },
          ],
        },
        handler: async (flags) => {
          const spinner = rapider.ui.logs.spinner({
            label: `Adding ${flags.name} to the barnyard.`,
          });
          const animals = await store.get("animals");
          const newAnimal = {
            //@ts-ignore
            id: animals ? (animals as []).slice(-1)[0].id + 1 : 0,
            name: flags.name,
          };
          await store.addElement("animals", [newAnimal]);
          spinner.dismiss();
          rapider.ui.logs.SUCCESS("Animal added.");
        },
      },
      build: {
        name: "Build",
        description: "Build something in the barnyard.",

        flags: {
          named: [
            {
              key: "material",
              description: "Material used to build house.",
              aliases: ["m"],
              type: rapider.flags.types.string(),
              default: "wood",
              rules: [
                rapider.flags.rules.oneOf(() => ["wood", "stone", "metal"]),
              ],
            },
          ],
        },

        scopes: {
          pen: {
            name: "Build Pen",
            description: "Build a new pen for animals.",
            flags: {
              named: [
                {
                  key: "size",
                  type: rapider.flags.types.int(),
                  rules: [
                    rapider.flags.rules.required(),
                    rapider.flags.rules.positive(),
                    rapider.flags.rules.lessThan(() => 10),
                  ],
                },
              ],
            },
            handler: async (flags) => {
              console.log(
                `Building a pen out of ${flags.material} for ${flags.size} animals.`
              );
              const spinner = rapider.ui.logs.spinner();
              setTimeout(spinner.dismiss, 5000);
            },
          },
          house: {
            name: "Build House",
            description: "Build a new house for people.",
            flags: {
              named: [
                {
                  key: "rooms",
                  type: rapider.flags.types.int(),
                  rules: [rapider.flags.rules.required()],
                },
              ],
            },
            handler: async (flags) =>
              console.log(
                `Building a house out of ${flags.material} with ${flags.rooms} rooms.`
              ),
          },
        },
      },
    },
  };

  rapider.run(cli);
}

main();
