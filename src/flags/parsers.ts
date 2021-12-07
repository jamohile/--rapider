import { IFlag, INamedFlag } from ".";

export interface IFlagParserResult {
  flags: Record<string, any>;
  remainingCommand: string[];
}

export class FlagsParser {
  parse(flags: IFlag<any>[], command: string[], initialFlags: Record<string, any>): IFlagParserResult {
    const result: IFlagParserResult = {
      flags: initialFlags,
      remainingCommand: [...command],
    };
    for (const flag of flags) {
      // Don't overwrite existing values.
      if (result.flags[flag.key] !== undefined) {
        continue;
      }
      if (flag.default !== undefined) {
        result.flags[flag.key] = flag.default;
      } else if (flag.type.default !== undefined) {
        result.flags[flag.key] = flag.type.default;
      }
    }
    return result;
  }

  static chain(
    command: string[],
    parsers_and_flags: [FlagsParser, IFlag<any>[]][],
    initialFlags: Record<string, any>
  ) {
    const result: IFlagParserResult = {
      flags: initialFlags,
      remainingCommand: [...command],
    };
    for (const [parser, flags] of parsers_and_flags) {
      const intermediate_result = parser.parse(flags, result.remainingCommand, result.flags);
      result.flags = { ...result.flags, ...intermediate_result.flags };
      result.remainingCommand = intermediate_result.remainingCommand;
    }
    return result;
  }
}

export class PositionalFlagsParser extends FlagsParser {
  parse(flags: IFlag<any>[], command: string[], initialFlags: Record<string, any>): IFlagParserResult {
    const result = super.parse(flags, command, initialFlags);

    for (const flag of flags) {
      if (result.remainingCommand.length) {
        const data = result.remainingCommand.splice(0, flag.type.length);
        result.flags[flag.key] = flag.type.parse(data);
      }
    }

    return result;
  }
}

export class NamedFlagsParser extends FlagsParser {
  parse(flags: INamedFlag<any>[], command: string[], initialFlags: Record<string, any>): IFlagParserResult {
    const result = super.parse(flags, command, initialFlags);

    const flagsIndex = new Map<string, INamedFlag<any>>();

    for (const flag of flags) {
      const aliases = [flag.key, ...(flag.aliases || [])];
      for (const alias of aliases) {
        flagsIndex.set(alias.length === 1 ? `-${alias}` : `--${alias}`, flag);
      }
      flagsIndex.set(`--${flag.key}`, flag);
    }

    while (flagsIndex.has(result.remainingCommand[0])) {
      const token = result.remainingCommand[0];
      const flag = flagsIndex.get(token) as INamedFlag<any>;

      const [key, ...data] = result.remainingCommand.splice(
        0,
        flag.type.length + 1
      );
      result.flags[flag.key] = flag.type.parse(data);
    }
    return result;
  }
}
