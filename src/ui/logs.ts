import chalk from "chalk";
import { clearNLines } from "./utils";

export const indent = {
  spacesPerIndent: 2,
  currentIndent: 0,

  increase: () => (indent.currentIndent += 1),
  decrease: () => (indent.currentIndent -= 1),
  set: (num: number) => (indent.currentIndent = num),
  reset: () => indent.set(0),

  compute: () => " ".repeat(indent.spacesPerIndent * indent.currentIndent),
  wrap: (message: string) => indent.compute() + message,
};

interface ILog {
  prev?: ILog;
  next?: ILog;
  message?: string;

  draw: () => void;
  clear: () => void;
  delete: () => void;
  refresh: (message: string) => void;
}

let LAST_LOG: ILog;

export const LOG = (message: string, log = console.log) => {
  const wrappedMessage = indent.wrap(message);

  const newLog: ILog = {
    prev: LAST_LOG,
    message: wrappedMessage,

    clear: () => {
      if (newLog.next) {
        newLog.next.clear();
      }
      clearNLines(1);
      console.log(
        "                                                                                  "
      );
      clearNLines(1);
    },
    draw: () => {
      log(newLog.message);
      if (newLog.next) {
        newLog.next.draw();
      }
    },
    delete: () => {
      newLog.clear();
      const nextLog = newLog.next;
      if (newLog.prev) {
        newLog.prev.next = nextLog;
      }
      if (nextLog) {
        nextLog.prev = newLog.prev;
        nextLog.draw();
      }
    },
    refresh: (message: string) => {
      newLog.clear();
      newLog.message = message;
      newLog.draw();
    },
  };
  if (LAST_LOG) {
    LAST_LOG.next = newLog;
  }
  LAST_LOG = newLog;

  newLog.draw();
  return newLog;
};

export const ERROR = (message: string) => {
  throw new Error(chalk.red.bold("ERROR: ") + message);
};

export const FATAL = (message: string) => {
  console.error(chalk.red.bold("FATAL: ") + message);
  process.exit();
};

export const WARN = (message: string) => {
  console.warn(indent.wrap(chalk.yellow.bold("WARN: ") + message));
};

export const INFO = (message: string) => {
  console.info(indent.wrap(chalk.blue.bold("INFO: ") + message));
};
export const SUCCESS = (message: string) => {
  console.info(indent.wrap(chalk.green.bold("SUCCESS: ") + message));
};

interface IProgressBar {
  // 0-1 float indicating initial progress.
  initial?: number;
}
const PROGRESS_BAR_WIDTH = 30;
export const progressBar = (args: IProgressBar) => {
  let progressBarLog: ILog;
  let itemLogs: ILog[] = [];

  const draw = (progress: number) => {
    // Bounds displayed progress between 0 and 1.
    const boundedProgress = Math.max(Math.min(progress, 1), 0);
    const progress_width = Math.floor(
      PROGRESS_BAR_WIDTH * Math.min(boundedProgress, 1)
    );
    progressBarLog = LOG(
      chalk.green(
        "|" +
          "=".repeat(progress_width) +
          "-".repeat(PROGRESS_BAR_WIDTH - progress_width) +
          "|"
      ) + ` ${Math.floor(100 * progress)}%`
    );
  };

  draw(args.initial || 0);
  return {
    set: (progress: number, items: string[] = []) => {
      progressBarLog?.delete();
      itemLogs.forEach((log) => log.delete());
      draw(progress);
      itemLogs = items.map((item) => LOG("... " + item));
    },
  };
};

interface ISpinner {
  label?: string;
}

export const spinner = (args: ISpinner = {}) => {
  //const phases = ["--", "\\", "|", "/"];
  const phases = ["==---", "-==--", "--==-", "---==", "=---="];
  let i = 0;

  let spinnerLog: ILog;

  const draw = () => {
    const label = args.label || "Loading ";
    spinnerLog = LOG(label + " " + phases[i] + " ");
  };

  draw();
  const interval = setInterval(() => {
    i += 1;
    if (i === phases.length) {
      i = 0;
    }
    spinnerLog.delete();
    draw();
  }, 100);

  const spinnerObject = {
    wrap: (promise: Promise<any>) => {
      promise.then(() => spinnerObject.dismiss());
      return spinnerObject;
    },
    dismiss: () => {
      clearInterval(interval);
      spinnerLog.delete();
    },
  };

  return spinnerObject;
};

export const withSpinner = async <T>(
  handler: () => Promise<T>,
  args: ISpinner = {}
) => {
  const promise = handler();
  spinner(args).wrap(promise);
  return await promise;
};

// Progress Bar Test:
//
// const bar = progressBar({});
// setTimeout(() => bar.set(0.5), 500);
// setTimeout(() => bar.set(0.7, ["ab", "cd", "ef"]), 1000);
// setTimeout(() => bar.set(0.1, ["ab", "gh", "ef"]), 1500);
