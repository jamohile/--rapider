import path from "path";
import fs from "fs";
import os from "os";

import * as rapider from "../src";

function captureLogs() {
  let output: string[] = [];

  const logSpy = jest.spyOn(console, "log").mockImplementation((str) => {
    output.push(str);
  });

  return [() => output, () => logSpy.mockRestore()];
}

describe("Flags", () => {
  describe("General", () => {
    it("Gives scopes access to flags from parent scopes.", async () => {
      const spy = jest.fn();
      await rapider.run(
        {
          scopes: {
            parent: {
              scopes: {
                command: {
                  handler: spy,
                },
              },
              flags: {
                named: [{ key: "foo", type: rapider.flags.types.presence() }],
              },
            },
          },
        },
        ["parent", "--foo", "command"]
      );
      expect(spy).toHaveBeenCalledWith({ foo: true });
    });
    it("Supports mix of positional and named flags (before positional)", async () => {
      const spy = jest.fn();
      await rapider.run(
        {
          scopes: {
            command: {
              flags: {
                named: [{ key: "named", type: rapider.flags.types.presence() }],
                positional: [
                  { key: "foo", type: rapider.flags.types.string() },
                  { key: "bar", type: rapider.flags.types.string() },
                ],
              },
              handler: spy,
            },
          },
        },
        ["command", "--named", "apple", "orange"]
      );
      expect(spy).toHaveBeenCalledWith({
        named: true,
        foo: "apple",
        bar: "orange",
      });
    });
  });
  describe("Named Flags", () => {
    it("Parses a named string argument.", async () => {
      const spy = jest.fn();
      await rapider.run(
        {
          scopes: {
            command: {
              flags: {
                named: [{ key: "foo", type: rapider.flags.types.string() }],
              },
              handler: spy,
            },
          },
        },
        ["command", "--foo", "apple"]
      );
      expect(spy).toHaveBeenCalledWith({ foo: "apple" });
    });

    it("Parses a parent-scope named string argument, passed to child.", async () => {
      const spy = jest.fn();
      await rapider.run(
        {
          flags: {
            named: [{ key: "foo", type: rapider.flags.types.string() }],
          },
          scopes: {
            command: {
              handler: spy,
            },
          },
        },
        ["command", "--foo", "apple"]
      );
      expect(spy).toHaveBeenCalledWith({ foo: "apple" });
    });

    it("Allows required parent-scope named arguments to be passed at child, with no error.", async () => {
      const spy = jest.fn();
      await rapider.run(
        {
          flags: {
            named: [
              {
                key: "foo",
                type: rapider.flags.types.string(),
                rules: [rapider.flags.rules.required()],
              },
            ],
          },
          scopes: {
            command: {
              handler: spy,
            },
          },
        },
        ["command", "--foo", "apple"]
      );
      expect(spy).toHaveBeenCalledWith({ foo: "apple" });
    });

    it("Supports both long and shortform named arguments.", async () => {
      const spy = jest.fn();
      const cli = {
        scopes: {
          command: {
            flags: {
              named: [
                {
                  key: "foo",
                  aliases: ["f"],
                  type: rapider.flags.types.string(),
                },
              ],
            },
            handler: spy,
          },
        },
      };
      await rapider.run(cli, ["command", "--foo", "apple"]);
      expect(spy).toHaveBeenCalledWith({ foo: "apple" });

      spy.mockReset();

      await rapider.run(cli, ["command", "-f", "apple"]);
      expect(spy).toHaveBeenCalledWith({ foo: "apple" });
    });

    it("Supports named flag defaults.", async () => {
      const spy = jest.fn();
      await rapider.run(
        {
          scopes: {
            command: {
              flags: {
                named: [
                  {
                    key: "foo",
                    type: rapider.flags.types.string(),
                    default: "orange",
                  },
                ],
              },
              handler: spy,
            },
          },
        },
        ["command"]
      );
      expect(spy).toHaveBeenCalledWith({ foo: "orange" });
    });

    it("Shows error if required named flag not provided.", async () => {
      const spy = jest.fn();
      await expect(
        rapider.run(
          {
            scopes: {
              command: {
                name: "Command",
                description: "Lorem ipsum delorum.",
                flags: {
                  named: [
                    {
                      key: "foo",
                      type: rapider.flags.types.string(),
                      rules: [rapider.flags.rules.required()],
                    },
                  ],
                },
                handler: spy,
              },
            },
          },
          ["command"]
        )
      ).rejects.toMatchObject({ message: expect.stringMatching("foo") });
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("Positional Flags", () => {
    it("Supports positional args defaults.", async () => {
      const spy = jest.fn();
      await rapider.run(
        {
          scopes: {
            command: {
              flags: {
                positional: [
                  { key: "foo", type: rapider.flags.types.string() },
                  {
                    key: "bar",
                    type: rapider.flags.types.string(),
                    default: "banana",
                  },
                ],
              },
              handler: spy,
            },
          },
        },
        ["command", "apple"]
      );
      expect(spy).toHaveBeenCalledWith({ foo: "apple", bar: "banana" });
    });
    it("Supports positional flags.", async () => {
      const spy = jest.fn();
      await rapider.run(
        {
          scopes: {
            command: {
              flags: {
                positional: [
                  { key: "foo", type: rapider.flags.types.string() },
                  { key: "bar", type: rapider.flags.types.string() },
                ],
              },
              handler: spy,
            },
          },
        },
        ["command", "apple", "orange"]
      );
      expect(spy).toHaveBeenCalledWith({ foo: "apple", bar: "orange" });
    });
  });
});

describe("Flag Types", () => {
  describe("JSON", () => {
    it("handles valid JSON.", async () => {
      const spy = jest.fn();
      await rapider.run(
        {
          scopes: {
            command: {
              flags: {
                named: [{ key: "foo", type: rapider.flags.types.json() }],
              },
              handler: spy,
            },
          },
        },
        ["command", "--foo", '{"a": 1, "b": [1, 2]}']
      );
      expect(spy).toHaveBeenCalledWith({ foo: { a: 1, b: [1, 2] } });
    });
    it("rejects invalid JSON.", async () => {
      const spy = jest.fn();
      await expect(
        rapider.run(
          {
            scopes: {
              command: {
                flags: {
                  named: [{ key: "foo", type: rapider.flags.types.json() }],
                },
                handler: spy,
              },
            },
          },
          ["command", "--foo", '{"a": 1, b: [1, 2}']
        )
        // TODO: flag-aware error message.
      ).rejects.toMatchObject({ message: expect.stringContaining("JSON") });
    });
  });
  describe("FS", () => {
    describe("Files", () => {
      it("handles path names.", async () => {
        const spy = jest.fn();
        await rapider.run(
          {
            scopes: {
              command: {
                flags: {
                  named: [{ key: "foo", type: rapider.flags.types.path() }],
                },
                handler: spy,
              },
            },
          },
          ["command", "--foo", "/test.txt"]
        );
        expect(spy).toHaveBeenCalledWith({ foo: "/test.txt" });
      });
      it("normalizes relative path names.", async () => {
        const spy = jest.fn();
        await rapider.run(
          {
            scopes: {
              command: {
                flags: {
                  named: [{ key: "foo", type: rapider.flags.types.path() }],
                },
                handler: spy,
              },
            },
          },
          ["command", "--foo", "../test.txt"]
        );
        expect(spy).toHaveBeenCalledWith({
          foo: path.normalize(path.join(process.cwd(), "../test.txt")),
        });
      });
    });
  });
  describe("Presence", () => {
    it("Supports presence flags.", async () => {
      const spy = jest.fn();
      await rapider.run(
        {
          scopes: {
            command: {
              flags: {
                named: [{ key: "foo", type: rapider.flags.types.presence() }],
              },
              handler: spy,
            },
          },
        },
        ["command", "--foo"]
      );
      expect(spy).toHaveBeenCalledWith({ foo: true });
    });

    it("Supports presence flag default.", async () => {
      const spy = jest.fn();
      await rapider.run(
        {
          scopes: {
            command: {
              flags: {
                named: [{ key: "foo", type: rapider.flags.types.presence() }],
              },
              handler: spy,
            },
          },
        },
        ["command"]
      );
      expect(spy).toHaveBeenCalledWith({ foo: undefined });
    });
  });
  describe("List", () => {
    it("Supports comma separated list argument.", async () => {
      const spy = jest.fn();
      await rapider.run(
        {
          scopes: {
            command: {
              flags: {
                named: [{ key: "list", type: rapider.flags.types.list({}) }],
              },
              handler: spy,
            },
          },
        },
        ["command", "--list", "red,green,blue"]
      );
      expect(spy).toHaveBeenCalledWith({
        list: ["red", "green", "blue"],
      });
    });

    it("Supports custom separated list argument.", async () => {
      const spy = jest.fn();
      await rapider.run(
        {
          scopes: {
            command: {
              flags: {
                named: [
                  {
                    key: "list",
                    type: rapider.flags.types.list({ separator: ":" }),
                  },
                ],
              },
              handler: spy,
            },
          },
        },
        ["command", "--list", "red:green:blue"]
      );
      expect(spy).toHaveBeenCalledWith({
        list: ["red", "green", "blue"],
      });
    });

    it("Supports comma separated list argument with (float) type.", async () => {
      const spy = jest.fn();
      await rapider.run(
        {
          scopes: {
            command: {
              flags: {
                named: [
                  {
                    key: "list",
                    type: rapider.flags.types.list({
                      type: rapider.flags.types.float(),
                    }),
                  },
                ],
              },
              handler: spy,
            },
          },
        },
        ["command", "--list", "1.0, 2.0, 3.3"]
      );
      expect(spy).toHaveBeenCalledWith({
        list: [1.0, 2.0, 3.3],
      });
    });
  });
  describe("Integer", () => {
    it("Supports integer flag.", async () => {
      const spy = jest.fn();
      await rapider.run(
        {
          scopes: {
            command: {
              flags: {
                named: [{ key: "num", type: rapider.flags.types.int() }],
              },
              handler: spy,
            },
          },
        },
        ["command", "--num", "5"]
      );
      expect(spy).toHaveBeenCalledWith({
        num: 5,
      });
    });
  });
  describe("Float", () => {
    it("Supports float flag.", async () => {
      const spy = jest.fn();
      await rapider.run(
        {
          scopes: {
            command: {
              flags: {
                named: [{ key: "num", type: rapider.flags.types.float() }],
              },
              handler: spy,
            },
          },
        },
        ["command", "--num", "5.2"]
      );
      expect(spy).toHaveBeenCalledWith({
        num: 5.2,
      });
    });
  });
  describe("Date", () => {
    it("Supports date flag.", async () => {
      let date: Date = new Date();
      const spy = jest.fn((args) => (date = args.date));
      await rapider.run(
        {
          scopes: {
            command: {
              flags: {
                named: [{ key: "date", type: rapider.flags.types.date() }],
              },
              handler: spy,
            },
          },
        },
        ["command", "--date", "2021-08-13"]
      );

      // Note: this is one lower month because JS months are 0 based.
      expect(date.valueOf()).toEqual(
        new Date(2021, 7, 13, 0, 0, 0, 0).valueOf()
      );
    });
    it("Handles date with missing day.", async () => {
      let date: Date = new Date();
      const spy = jest.fn((args) => (date = args.date));
      await rapider.run(
        {
          scopes: {
            command: {
              flags: {
                named: [{ key: "date", type: rapider.flags.types.date() }],
              },
              handler: spy,
            },
          },
        },
        ["command", "--date", "2021-08"]
      );

      // Note: this is one lower month because JS months are 0 based.
      expect(date.valueOf()).toEqual(
        new Date(2021, 7, 1, 0, 0, 0, 0).valueOf()
      );
    });
    it("Handles date with missing leading 0s.", async () => {
      let date: Date = new Date();
      const spy = jest.fn((args) => (date = args.date));
      await rapider.run(
        {
          scopes: {
            command: {
              flags: {
                named: [{ key: "date", type: rapider.flags.types.date() }],
              },
              handler: spy,
            },
          },
        },
        ["command", "--date", "2021-8"]
      );

      // Note: this is one lower month because JS months are 0 based.
      expect(date.valueOf()).toEqual(
        new Date(2021, 7, 1, 0, 0, 0, 0).valueOf()
      );
    });
    it("Handles date with missing day, month.", async () => {
      let date: Date = new Date();
      const spy = jest.fn((args) => (date = args.date));
      await rapider.run(
        {
          scopes: {
            command: {
              flags: {
                named: [{ key: "date", type: rapider.flags.types.date() }],
              },
              handler: spy,
            },
          },
        },
        ["command", "--date", "2021"]
      );

      expect(date.valueOf()).toEqual(
        new Date(2021, 0, 1, 0, 0, 0, 0).valueOf()
      );
    });
  });
});

describe("Help", () => {
  it("Shows a basic help menu if requested.", async () => {
    const [getLogs, restoreLogs] = captureLogs();

    await rapider.run(
      {
        scopes: {
          command: {
            name: "Command",
            description: "Lorem ipsum delorum.",
          },
        },
      },
      ["command", "--help"]
    );

    restoreLogs();
    expect(getLogs()).toMatchSnapshot();
  });
  it("Shows subcommands in scope help.", async () => {
    const [getLogs, restoreLogs] = captureLogs();

    await rapider.run(
      {
        scopes: {
          command: {
            name: "Command",
            description: "Lorem ipsum delorum.",
            scopes: {
              foo: {},
              bar: {},
            },
          },
        },
      },
      ["command", "--help"]
    );

    restoreLogs();
    expect(getLogs()).toMatchSnapshot();
  });
  it("Shows named flags in help.", async () => {
    const [getLogs, restoreLogs] = captureLogs();

    await rapider.run(
      {
        scopes: {
          command: {
            name: "Command",
            description: "Lorem ipsum delorum.",
            flags: {
              named: [
                { key: "foo", type: rapider.flags.types.string() },
                {
                  key: "bar",
                  aliases: ["b"],
                  type: rapider.flags.types.float(),
                  description: "hello",
                },
              ],
            },
          },
        },
      },
      ["command", "--help"]
    );

    restoreLogs();
    expect(getLogs()).toMatchSnapshot();
  });
  it("Shows positional flags in help.", async () => {
    const [getLogs, restoreLogs] = captureLogs();

    await rapider.run(
      {
        scopes: {
          command: {
            name: "Command",
            description: "Lorem ipsum delorum.",
            flags: {
              positional: [
                { key: "foo", type: rapider.flags.types.string() },
                {
                  key: "bar",
                  type: rapider.flags.types.float(),
                  description: "hello",
                },
              ],
            },
          },
        },
      },
      ["command", "--help"]
    );

    restoreLogs();
    expect(getLogs()).toMatchSnapshot();
  });
});

describe("Flag Rules", () => {
  describe("One Of", () => {
    it("Shows no error if string argument one of approved items.", async () => {
      const spy = jest.fn();
      await rapider.run(
        {
          scopes: {
            command: {
              name: "Command",
              description: "Lorem ipsum delorum.",
              flags: {
                named: [
                  {
                    key: "foo",
                    type: rapider.flags.types.string(),
                    rules: [
                      rapider.flags.rules.oneOf(() => ["apple", "orange"]),
                      rapider.flags.rules.required(),
                    ],
                  },
                ],
              },
              handler: spy,
            },
          },
        },
        ["command", "--foo", "apple"]
      );

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          foo: "apple",
        })
      );
    });

    it("Shows error if string argument not one of approved items.", async () => {
      const spy = jest.fn();

      await expect(
        rapider.run(
          {
            scopes: {
              command: {
                name: "Command",
                description: "Lorem ipsum delorum.",
                flags: {
                  named: [
                    {
                      key: "foo",
                      type: rapider.flags.types.string(),
                      rules: [
                        rapider.flags.rules.oneOf(() => ["apple", "orange"]),
                        rapider.flags.rules.required(),
                      ],
                    },
                  ],
                },
                handler: spy,
              },
            },
          },
          ["command", "--foo", "banana"]
        )
      ).rejects.toMatchObject({ message: expect.stringMatching("foo") });

      expect(spy).not.toHaveBeenCalled();
    });
  });
  describe("Length", () => {
    it("Shows no error if string argument is of required length.", async () => {
      const spy = jest.fn();
      await rapider.run(
        {
          scopes: {
            command: {
              name: "Command",
              description: "Lorem ipsum delorum.",
              flags: {
                named: [
                  {
                    key: "foo",
                    type: rapider.flags.types.string(),
                    rules: [
                      rapider.flags.rules.length(() => 5),
                      rapider.flags.rules.required(),
                    ],
                  },
                ],
              },
              handler: spy,
            },
          },
        },
        ["command", "--foo", "12345"]
      );

      expect(spy).toHaveBeenCalledWith({ foo: "12345" });
    });
    it("Shows error if string argument not of required length.", async () => {
      const spy = jest.fn();

      await expect(
        rapider.run(
          {
            scopes: {
              command: {
                name: "Command",
                description: "Lorem ipsum delorum.",
                flags: {
                  named: [
                    {
                      key: "foo",
                      type: rapider.flags.types.string(),
                      rules: [
                        rapider.flags.rules.length(() => 5),
                        rapider.flags.rules.required(),
                      ],
                    },
                  ],
                },
                handler: spy,
              },
            },
          },
          ["command", "--foo", "banana"]
        )
      ).rejects.toMatchObject({ message: expect.stringMatching("foo") });

      expect(spy).not.toHaveBeenCalled();
    });
  });
  describe("Dependencies", () => {
    it("Shows error if dependent rule is not satisfied.", async () => {
      const spy = jest.fn();

      await expect(
        rapider.run(
          {
            scopes: {
              command: {
                name: "Command",
                description: "Lorem ipsum delorum.",
                flags: {
                  named: [
                    {
                      key: "from",
                      type: rapider.flags.types.date(),
                      rules: [rapider.flags.rules.required()],
                    },
                    {
                      key: "to",
                      type: rapider.flags.types.date(),
                      rules: [
                        rapider.flags.rules.required(),
                        rapider.flags.rules.greaterThan((flags) => flags.from),
                      ],
                    },
                  ],
                },
                handler: spy,
              },
            },
          },
          ["command", "--from", "2021-8-1", "--to", "2021-7-1"]
        )
      ).rejects.toMatchObject({ message: expect.stringMatching("to") });

      expect(spy).not.toHaveBeenCalled();
    });
    it("Shows no error if dependent rule is satisfied.", async () => {
      const spy = jest.fn();

      await rapider.run(
        {
          scopes: {
            command: {
              name: "Command",
              description: "Lorem ipsum delorum.",
              flags: {
                named: [
                  {
                    key: "from",
                    type: rapider.flags.types.date(),
                    rules: [rapider.flags.rules.required()],
                  },
                  {
                    key: "to",
                    type: rapider.flags.types.date(),
                    rules: [
                      rapider.flags.rules.required(),
                      rapider.flags.rules.greaterThan((flags) => flags.from),
                    ],
                  },
                ],
              },
              handler: spy,
            },
          },
        },
        ["command", "--from", "2021-8-1", "--to", "2021-9-1"]
      );
      expect(spy).toHaveBeenCalled();
    });
  });
  describe("Files", () => {
    it("can check if file exists.", async () => {
      const spy = jest.fn();
      await rapider.run(
        {
          scopes: {
            command: {
              flags: {
                named: [
                  {
                    key: "foo",
                    type: rapider.flags.types.path(),
                    rules: [rapider.flags.rules.pathExists({})],
                  },
                ],
              },
              handler: spy,
            },
          },
        },
        ["command", "--foo", "/tmp"]
      );
      expect(spy).toHaveBeenCalledWith({ foo: "/tmp" });
    });
    it("can throw error if file doesn't exist.", async () => {
      const spy = jest.fn();
      await expect(
        rapider.run(
          {
            scopes: {
              command: {
                flags: {
                  named: [
                    {
                      key: "foo",
                      type: rapider.flags.types.path(),
                      rules: [rapider.flags.rules.pathExists({})],
                    },
                  ],
                },
                handler: spy,
              },
            },
          },
          ["command", "--foo", "/tmpp"]
        )
      ).rejects.toMatchObject({ message: expect.stringContaining("foo") });
    });
    it("can check if file parent exists, e.g for output files.", async () => {
      const spy = jest.fn();
      await rapider.run(
        {
          scopes: {
            command: {
              flags: {
                named: [
                  {
                    key: "foo",
                    type: rapider.flags.types.path(),
                    rules: [rapider.flags.rules.pathExists({ parent: true })],
                  },
                ],
              },
              handler: spy,
            },
          },
        },
        ["command", "--foo", "src/fakefile.js"]
      );
      expect(spy).toHaveBeenCalledWith({
        foo: path.join(process.cwd(), "src/fakefile.js"),
      });
    });
  });
  describe("Custom", () => {
    it("can check if file exists.", async () => {
      const spy = jest.fn();
      const ruleSpy = jest.fn().mockImplementation((data) => true);

      await rapider.run(
        {
          scopes: {
            command: {
              flags: {
                named: [
                  {
                    key: "foo",
                    type: rapider.flags.types.string(),
                    rules: [rapider.flags.rules.custom(ruleSpy)],
                  },
                ],
              },
              handler: spy,
            },
          },
        },
        ["command", "--foo", "apple"]
      );
      expect(spy).toHaveBeenCalledWith({ foo: "apple" });
      expect(ruleSpy).toHaveBeenCalledWith(
        "apple",
        expect.objectContaining({ foo: "apple" })
      );
    });
  });
});

describe("Basic Runner", () => {
  it("Calls cli handler with no sub-commands or other args.", async () => {
    const spy = jest.fn();
    await rapider.run({
      handler: spy,
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("Calls correct nested cli handler.", async () => {
    const spy = jest.fn();
    const otherSpy = jest.fn();
    await rapider.run(
      {
        scopes: {
          parent: {
            scopes: {
              correct: {
                handler: spy,
              },
              other: {
                handler: otherSpy,
              },
            },
          },
        },
      },
      ["parent", "correct"]
    );
    expect(spy).toHaveBeenCalledTimes(1);
    expect(otherSpy).not.toHaveBeenCalled();
  });

  it("Allows scopes to also have a default handler.", async () => {
    const spy = jest.fn();
    const otherSpy = jest.fn();

    await rapider.run(
      {
        scopes: {
          parent: {
            scopes: {
              correct: {
                handler: otherSpy,
              },
            },
            handler: spy,
          },
        },
      },
      ["parent"]
    );
    expect(spy).toHaveBeenCalledTimes(1);
    expect(otherSpy).not.toHaveBeenCalled();
  });

  // TODO
  //   it("Does not support named arguments after positional.", async () => {});

  it("Shows error if all elements of list flag not part of approved.", async () => {
    const spy = jest.fn();

    await expect(
      rapider.run(
        {
          scopes: {
            command: {
              name: "Command",
              description: "Lorem ipsum delorum.",
              flags: {
                named: [
                  {
                    key: "foo",
                    type: rapider.flags.types.list({
                      type: rapider.flags.types.string(),
                    }),
                    rules: [
                      rapider.flags.rules.allOneOf(() => ["apple", "orange"]),
                      rapider.flags.rules.required(),
                    ],
                  },
                ],
              },
              handler: spy,
            },
          },
        },
        ["command", "--foo", "apple,orange,banana"]
      )
    ).rejects.toMatchObject({ message: expect.stringMatching("foo") });

    expect(spy).not.toHaveBeenCalled();
  });

  it("Shows error if all elements of list are not unique, if specified.", async () => {
    const spy = jest.fn();

    await expect(
      rapider.run(
        {
          scopes: {
            command: {
              name: "Command",
              description: "Lorem ipsum delorum.",
              flags: {
                named: [
                  {
                    key: "foo",
                    type: rapider.flags.types.list({
                      type: rapider.flags.types.string(),
                    }),
                    rules: [
                      rapider.flags.rules.unique(),
                      rapider.flags.rules.required(),
                    ],
                  },
                ],
              },
              handler: spy,
            },
          },
        },
        ["command", "--foo", "apple,orange,apple"]
      )
    ).rejects.toMatchObject({ message: expect.stringMatching("foo") });

    expect(spy).not.toHaveBeenCalled();
  });

  it("Shows no error if all elements of list unique, if specified.", async () => {
    const spy = jest.fn();

    await rapider.run(
      {
        scopes: {
          command: {
            name: "Command",
            description: "Lorem ipsum delorum.",
            flags: {
              named: [
                {
                  key: "foo",
                  type: rapider.flags.types.list({
                    type: rapider.flags.types.string(),
                  }),
                  rules: [
                    rapider.flags.rules.unique(),
                    rapider.flags.rules.required(),
                  ],
                },
              ],
            },
            handler: spy,
          },
        },
      },
      ["command", "--foo", "apple,orange,banana"]
    );

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        foo: ["apple", "orange", "banana"],
      })
    );
  });
});

describe("UI", () => {
  describe("Logging", () => {
    it("Shows various logs.", () => {
      const [getLogs, restoreLogs] = captureLogs();

      rapider.ui.logs.LOG("a");
      rapider.ui.logs.INFO("b");
      rapider.ui.logs.WARN("c");
      rapider.ui.logs.SUCCESS("d");

      expect(getLogs()).toMatchSnapshot();
      restoreLogs();
    });

    describe("Smart Logs", () => {
      it("Can clear log.", () => {
        const [getLogs, restoreLogs] = captureLogs();

        const log = rapider.ui.logs.LOG("hello");
        log.clear();

        restoreLogs();
        expect(getLogs()).toMatchSnapshot();
      });
      it("Can clear logs further back in history.", () => {
        const [getLogs, restoreLogs] = captureLogs();

        const log1 = rapider.ui.logs.LOG("hello1");
        const log2 = rapider.ui.logs.LOG("hello2");
        log1.clear();

        restoreLogs();
        expect(getLogs()).toMatchSnapshot();
      });
      it("Can delete latest log.", () => {
        const [getLogs, restoreLogs] = captureLogs();

        const log = rapider.ui.logs.LOG("hello");
        log.delete();

        restoreLogs();
        expect(getLogs()).toMatchSnapshot();
      });
      it("Can delete further back log.", () => {
        const [getLogs, restoreLogs] = captureLogs();

        const log1 = rapider.ui.logs.LOG("hello1");
        const log2 = rapider.ui.logs.LOG("hello2");
        log1.delete();

        restoreLogs();
        expect(getLogs()).toMatchSnapshot();
      });
      it("Can refresh latest log.", () => {
        const [getLogs, restoreLogs] = captureLogs();

        const log = rapider.ui.logs.LOG("hello");
        log.refresh("hello2");

        restoreLogs();
        expect(getLogs()).toMatchSnapshot();
      });
      it("Can refresh further back log.", () => {
        const [getLogs, restoreLogs] = captureLogs();

        const log1 = rapider.ui.logs.LOG("hello1");
        const log2 = rapider.ui.logs.LOG("hello2");
        log1.refresh("hello3");

        restoreLogs();
        expect(getLogs()).toMatchSnapshot();
      });
    });

    describe("Indenting", () => {
      it("Allows indenting.", () => {
        const [getLogs, restoreLogs] = captureLogs();
        rapider.ui.logs.indent.increase();
        rapider.ui.logs.LOG("test");
        rapider.ui.logs.indent.decrease();

        restoreLogs();
        expect(getLogs()).toMatchSnapshot();
      });
      it("Allows un-indenting.", () => {
        const [getLogs, restoreLogs] = captureLogs();
        rapider.ui.logs.indent.increase();
        rapider.ui.logs.indent.decrease();
        rapider.ui.logs.LOG("test");

        restoreLogs();
        expect(getLogs()).toMatchSnapshot();
      });
      it("Allows indent reset.", () => {
        const [getLogs, restoreLogs] = captureLogs();
        rapider.ui.logs.indent.increase();
        rapider.ui.logs.indent.reset();
        rapider.ui.logs.LOG("test");

        restoreLogs();
        expect(getLogs()).toMatchSnapshot();
      });
    });

    describe("Progress", () => {
      it("Shows progress bar with initial 0.", () => {
        const [getLogs, restoreLogs] = captureLogs();

        const pb = rapider.ui.logs.progressBar({});

        const logs = getLogs();
        expect(logs).toContainEqual(expect.stringMatching("0%"));
        expect(getLogs()).toMatchSnapshot();
        restoreLogs();
      });
      it("Shows progress bar with custom initial.", () => {
        const [getLogs, restoreLogs] = captureLogs();

        const pb = rapider.ui.logs.progressBar({ initial: 0.5 });

        const logs = getLogs();
        expect(logs).toContainEqual(expect.stringMatching("50%"));
        expect(getLogs()).toMatchSnapshot();
        restoreLogs();
      });
      it("Allows updating progress bar.", () => {
        const [getLogs, restoreLogs] = captureLogs();

        const pb = rapider.ui.logs.progressBar({});
        pb.set(0.5);

        const logs = getLogs();
        expect(logs).toContainEqual(expect.stringMatching("50%"));
        expect(getLogs()).toMatchSnapshot();
        restoreLogs();
      });
      it("Allows updating progress bar with items.", () => {
        const [getLogs, restoreLogs] = captureLogs();

        const pb = rapider.ui.logs.progressBar({});
        pb.set(0.5, ["foo", "bar"]);

        const logs = getLogs();
        expect(logs).toContainEqual(expect.stringMatching("50%"));
        expect(logs).toContainEqual(expect.stringMatching("foo"));
        expect(logs).toContainEqual(expect.stringMatching("bar"));
        expect(getLogs()).toMatchSnapshot();
        restoreLogs();
      });
      it("Allows updating progress bar with less items.", () => {
        const [getLogs, restoreLogs] = captureLogs();

        const pb = rapider.ui.logs.progressBar({});
        pb.set(0.5, ["foo", "bar"]);
        pb.set(0.5, ["foo"]);

        const logs = getLogs();
        expect(getLogs()).toMatchSnapshot();
        restoreLogs();
      });
      it("Allows updating progress bar with more items.", () => {
        const [getLogs, restoreLogs] = captureLogs();

        const pb = rapider.ui.logs.progressBar({});
        pb.set(0.5, ["foo", "bar"]);
        pb.set(0.5, ["foo", "bar", "yo"]);

        const logs = getLogs();
        expect(getLogs()).toMatchSnapshot();
        restoreLogs();
      });
      it("Handles negative progress.", () => {
        const [getLogs, restoreLogs] = captureLogs();

        const pb = rapider.ui.logs.progressBar({ initial: -0.05 });

        const logs = getLogs();
        expect(logs).toContainEqual(expect.stringMatching("-5%"));
        expect(getLogs()).toMatchSnapshot();
        restoreLogs();
      });
      it("Handles >1 progress.", () => {
        const [getLogs, restoreLogs] = captureLogs();

        const pb = rapider.ui.logs.progressBar({ initial: 1.05 });

        const logs = getLogs();
        expect(logs).toContainEqual(expect.stringMatching("105%"));
        expect(getLogs()).toMatchSnapshot();
        restoreLogs();
      });
    });

    describe("Spinner", () => {
      it("Changes over time", (done) => {
        const [getLogs, restoreLogs] = captureLogs();
        const s = rapider.ui.logs.spinner();

        expect.assertions(1);
        setTimeout(() => {
          s.dismiss();
          restoreLogs();

          expect(getLogs()).toMatchSnapshot();
          done();
        }, 1000);
      });
      it("Supports labels", () => {
        const [getLogs, restoreLogs] = captureLogs();
        const s = rapider.ui.logs.spinner();
        s.dismiss();

        restoreLogs();
        expect(getLogs()).toMatchSnapshot();
      });
      it("Can wrap a promise.", (done) => {
        const dismissSpy = jest.fn();

        const s = rapider.ui.logs.spinner().wrap(
          new Promise((resolve) => {
            setTimeout(resolve, 2000);
          })
        );

        const originalDismiss = s.dismiss;

        dismissSpy.mockImplementation(originalDismiss);
        s.dismiss = dismissSpy;

        setTimeout(() => {
          expect(dismissSpy).toHaveBeenCalledTimes(1);
          done();
        }, 2500);
      });
    });
  });
  describe("Data", () => {
    it("displays table", () => {
      const [getLogs, restoreLogs] = captureLogs();

      rapider.ui.data
        .table({
          cols: { id: "ID", name: "Animal" },
          rows: [
            { id: 1, name: "Pig" },
            { id: 2, name: "Cow" },
            { id: 3, name: "Sheep" },
          ],
        })
        .print();

      restoreLogs();

      expect(getLogs()).toMatchSnapshot();
    });
    it("displays list", () => {
      const [getLogs, restoreLogs] = captureLogs();

      rapider.ui.data
        .list({
          title: "Animals",
          items: ["Pig", "Cow", "Sheep"],
        })
        .print();

      restoreLogs();

      expect(getLogs()).toMatchSnapshot();
    });
  });
});

describe("Store", () => {
  // TODO: use separate fir for testing.
  const rapiderDir = path.join(os.homedir(), ".rapider");

  afterEach(async () => {
    if (fs.existsSync(rapiderDir)) {
      fs.rmSync(rapiderDir, {
        recursive: true,
        force: true,
      });
    }
  });

  it("can register new stores", async () => {
    const store = await rapider.store.register("foo");

    expect(store.path).toEqual(path.join(os.homedir(), ".rapider", "foo"));
    expect(store.dataPath).toEqual(path.join(store.path, "data.json"));
    expect(fs.existsSync(store.dataPath));
  });

  it("can register store, even if files exist.", async () => {
    const store = await rapider.store.register("foo");
    const store2 = await rapider.store.register("foo");
  });

  it("can register store, even if files exist.", async () => {
    const store = await rapider.store.register("foo");
    const store2 = await rapider.store.register("foo");
  });

  it("can read data from a store.", async () => {
    const data = { field: { a: 1, b: [2, 3] } };
    const store = await rapider.store.register("foo");
    fs.writeFileSync(
      path.join(rapiderDir, "foo/data.json"),
      JSON.stringify(data)
    );
    expect(await store.get("field")).toEqual(data.field);
  });

  it("can read default values from store.", async () => {
    const store = await rapider.store.register("foo");
    expect(await store.get("field", { bar: 1 })).toEqual({ bar: 1 });
  });

  it("can add data to a store.", async () => {
    const data = { field: { a: 1, b: [2, 3] } };

    const store = await rapider.store.register("foo");
    await store.set("field", data.field);

    expect(
      JSON.parse(
        fs.readFileSync(path.join(rapiderDir, "foo/data.json")).toString()
      )
    ).toEqual(data);
  });

  it("can add data with a UUID.", async () => {
    const insertedData = { a: 1, b: [2, 3] };

    const store = await rapider.store.register("foo");
    await store.add("container", insertedData, { key: "uuid" });

    const container = await store.get("container");

    // @ts-ignore
    expect(Object.values(container)).toEqual([insertedData]);
  });

  it("can add data with a linear key.", async () => {
    const insertedData1 = { a: 1, b: [2, 3] };
    const insertedData2 = { a: 2, b: [2, 3] };

    const store = await rapider.store.register("foo");
    await store.add("container", insertedData1);
    await store.add("container", insertedData2);

    const container = await store.get("container");

    //@ts-ignore
    expect(Object.values(container)).toEqual([insertedData1, insertedData2]);
    //@ts-ignore
    expect(Object.keys(container)).toEqual(["1", "2"]);
  });

  it("can return object as keyed list.", async () => {
    const insertedData1 = { a: 1, b: [2, 3] };
    const insertedData2 = { a: 2, b: [2, 3] };

    const store = await rapider.store.register("foo");
    await store.add("container", insertedData1);
    await store.add("container", insertedData2);

    const items = await store.getKeyed("container");

    expect(items).toEqual([
      {
        key: "1",
        ...insertedData1,
      },
      { key: "2", ...insertedData2 },
    ]);
  });

  it("can read nested data from a store.", async () => {
    const store = await rapider.store.register("foo");
    await store.set("parent", {
      child1: {
        child2: {
          foo: "bar",
        },
      },
    });
    expect(await store.get("parent.child1.child2.foo")).toEqual("bar");
  });

  it("can set nested data to a store.", async () => {
    const store = await rapider.store.register("foo");
    await store.set("parent.child1.child2.foo", "bar");
    expect(await store.get("parent")).toEqual({
      child1: {
        child2: {
          foo: "bar",
        },
      },
    });
  });

  it("can delete nested data from a store.", async () => {
    const store = await rapider.store.register("foo");
    await store.set("parent.child1.child2.foo", "bar");

    const deletedData = await store.delete("parent.child1.child2.foo");
    expect(await store.get("parent")).toEqual({
      child1: {
        child2: {},
      },
    });
    expect(deletedData).toEqual("bar");
  });

  it("can handle deleting non-existent data.", async () => {
    const store = await rapider.store.register("foo");

    const deletedData = await store.delete("parent.child1.child2.foo");

    expect(await store.get("parent")).toEqual({
      child1: {
        child2: {},
      },
    });

    expect(deletedData).toBeUndefined();
  });

  it("can append array data to a store.", async () => {
    const store = await rapider.store.register("foo");
    await store.set("parent.child", [0, 1, 2]);
    await store.append("parent.child", [3]);
    expect(await store.get("parent")).toEqual({
      child: [0, 1, 2, 3],
    });
  });

  it("can update specific element from list.", async () => {
    const store = await rapider.store.register("foo");
    await store.set("elements", [
      { id: 1, name: "Foo" },
      { id: 2, name: "Bar" },
    ]);
    await store.updateElement(
      "elements",
      (item: any) => item.id === 1,
      (data: any) => ({ ...data, name: "Dog" })
    );
    expect(await store.get("elements")).toEqual([
      { id: 1, name: "Dog" },
      { id: 2, name: "Bar" },
    ]);
  });

  it("can delete specific element from list.", async () => {
    const store = await rapider.store.register("foo");
    await store.set("elements", [
      { id: 1, name: "Foo" },
      { id: 2, name: "Bar" },
    ]);
    await store.deleteElement("elements", (item: any) => item.id === 1);
    expect(await store.get("elements")).toEqual([{ id: 2, name: "Bar" }]);
  });

  it("can add new array data to a store.", async () => {
    const store = await rapider.store.register("foo");
    await store.append("parent.child", [0, 1, 2, 3]);
    expect(await store.get("parent")).toEqual({
      child: [0, 1, 2, 3],
    });
  });

  it("can overwrite non-array data in a store..", async () => {
    const store = await rapider.store.register("foo");
    await store.set("parent.child", "overwrite");
    await store.append("parent.child", [0, 1, 2, 3]);
    expect(await store.get("parent")).toEqual({
      child: [0, 1, 2, 3],
    });
  });

  it("can set nested data to a store, without interfering with existing data.", async () => {
    const store = await rapider.store.register("foo");
    await store.set("parent.child1.hello", "world");
    await store.set("parent.child1.child2.foo", "bar");
    expect(await store.get("parent")).toEqual({
      child1: {
        hello: "world",
        child2: {
          foo: "bar",
        },
      },
    });
  });

  it("can set nested data, overwriting parents if non-object type..", async () => {
    const store = await rapider.store.register("foo");
    await store.set("parent.child", "overwritten");
    await store.set("parent.child.foo", "bar");
    expect(await store.get("parent")).toEqual({
      child: { foo: "bar" },
    });
  });

  it("update data from a source.", async () => {
    const store = await rapider.store.register("foo");
    await store.set("parent", {
      counter: 1,
    });
    await store.update("parent.counter", (val) => val + 1);
    expect(await store.get("parent.counter")).toEqual(2);
  });
});
