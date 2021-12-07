import chalk from "chalk";

import { IFlag, INamedFlag, IPositionalFlag } from "./flags";
import {
  FlagsParser,
  NamedFlagsParser,
  PositionalFlagsParser,
} from "./flags/parsers";
import { FlagTypes } from "./flags/types";
import { FlagRules } from "./flags/rules";

import * as logs from "./ui/logs";
import * as data from "./ui/data";
import * as input from "./ui/input";

import * as _store from "./store";

export const flags = {
  types: FlagTypes,
  rules: FlagRules,
};

export const ui = {
  logs,
  data,
  input,
};

export const store = _store;

export interface ICli {
  // TODO: shouldn't be optional
  name?: string;
  description?: string;

  scopes?: Record<string, ICli>;
  flags?: {
    named?: INamedFlag<any>[];
    positional?: IPositionalFlag<any>[];
  };
  handler?: (flags: Record<string, any>) => Promise<any>;
}

enum CliType {
  SCOPE,
  COMMAND,
}

export async function run(
  cli: ICli,
  command = process.argv.slice(2),
  parentFlags: Record<string, any> = {},
  inheritedNamedFlags: INamedFlag<any>[] = []
): Promise<any> {
  const namedFlags = [...inheritedNamedFlags, ...(cli.flags?.named || [])];
  const positionalFlags = [...(cli.flags?.positional || [])];

  const cli_type = getCliType(cli);

  // Only add on root.
  if (inheritedNamedFlags.length === 0) {
    namedFlags.push({
      key: "help",
      type: FlagTypes.presence(),
      description: "See help for this command.",
    });
  }

  // Really, a subcommand is just a type of positional argument.
  // In user API, they are separate, but in code, special case it.
  if (cli_type === CliType.SCOPE) {
    const validScopes = Object.keys(cli.scopes!);
    positionalFlags.push({
      // This needs to be a reserved word.
      key: "scope",
      type: FlagTypes.string(),
      default: "",
      rules: [FlagRules.oneOf(() => [...validScopes, ""])],
    });
  }

  const result = FlagsParser.chain(
    command,
    [
      [new NamedFlagsParser(), namedFlags],
      [new PositionalFlagsParser(), positionalFlags],
      [new NamedFlagsParser(), namedFlags]
    ],
    parentFlags
  );

  const { scope, help, ...realFlags } = result.flags;

  // If this is a scope, and there is a valid sub-command being called, use that.
  if (scope) {
    // Only need to check current level flags, since parent's were checked there.
    // We check positional flags only, since named ones can be passed later on children.
    await validateRules(positionalFlags, result.flags);

    return run(
      cli.scopes![scope],
      result.remainingCommand,
      { ...realFlags, help },
      namedFlags
    );
  }

  // This being after scope is intentional.
  // This allows the user two ways of requesting help on nested scopes: "parent child --help" OR "parent --help child".
  // This is important because different tools do this differently, but now, it just works.
  if (help) {
    return showHelp(cli, inheritedNamedFlags);
  }

  // Otherwise, if we have a handler available, use that.
  if ("handler" in cli) {
    // Now, all the named flags (including those from parent) need to be evaluated.
    await validateRules([...namedFlags, ...positionalFlags], result.flags);
    return cli.handler!(realFlags);
  }

  return run(cli, ["--help"]);
}

async function validateRules(flags: IFlag<any>[], values: Record<string, any>) {
  for (const flag of flags) {
    const rules = [...(flag.rules || [])];
    for (const rule of rules) {
      const executedRule = rule(values);
      if ((await executedRule.check(values[flag.key])) === false) {
        logs.ERROR(
          `flag "${flag.key}" is invalid: ${await executedRule.message()}`
        );
      }
    }
  }
}

function showHelp(cli: ICli, inheritedNamedFlags: INamedFlag<any>[]) {
  const cli_type = getCliType(cli);

  logs.LOG(chalk.bold.green("[HELP] ") + cli.name + ": " + cli.description);

  if (cli_type === CliType.SCOPE) {
    logs.LOG("");
    logs.LOG(chalk.bold.blue("subcommands: "));
    ui.data
      .table({
        cols: { command: "Command", description: "Description" },
        rows: Object.entries(cli.scopes!).map(([command, scope]) => ({
          command,
          description: scope.description || "NO DESCRIPTION",
        })),
      })
      .print();
  }

  if (cli.flags) {
    if (cli.flags.positional) {
      logs.LOG("");
      logs.LOG(chalk.bold.blue("positional arguments:"));
      ui.data
        .table({
          cols: {
            position: "#",
            arg: "Arg",
            type: "Type",
            description: "Description",
          },
          rows: cli.flags.positional.map((flag, i) => ({
            position: i + 1,
            arg: flag.key || "",
            type: flag.type.name || "",
            description: flag.description || "",
          })),
        })
        .print();
    }
    if (cli.flags.named) {
      logs.LOG("");
      logs.LOG(chalk.bold.blue("named arguments:"));
      printNamedFlags(cli.flags.named);
    }
    // TODO: refactor duplicated.
    if (inheritedNamedFlags.length) {
      logs.LOG("");
      logs.LOG(chalk.bold.blue("inherited named arguments:"));
      printNamedFlags(inheritedNamedFlags);
    }
  }
}

function printNamedFlags(flags: INamedFlag<any>[]) {
  ui.data
    .table({
      cols: {
        arg: "Arg",
        type: "Type",
        aliases: "Alias",
        description: "Description",
      },
      rows: flags.map((flag) => ({
        arg: formatNamedFlag(flag.key),
        type: flag.type.name || "",
        aliases: (flag.aliases || []).map(formatNamedFlag).join("/"),
        description: flag.description || "",
      })),
    })
    .print();
}

function formatNamedFlag(name: string) {
  if (name.length === 1) {
    return "-" + name;
  } else {
    return "--" + name;
  }
}

function getCliType(cli: ICli): CliType {
  return "scopes" in cli ? CliType.SCOPE : CliType.COMMAND;
}
