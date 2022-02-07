import { CreateShellOptions, Shell, SpawnOptions, SpawnResult } from "./types";
import { spawn, execSync, ChildProcess } from "child_process";
import chalk from "chalk";

const WINDOWS = process.platform === "win32";

const DEFAULT_SPAWN_OPTIONS: SpawnOptions = {
  stdio: "inherit",
  shell: true,
  detached: !WINDOWS,
  env: process.env,
};

const DEFAULT_SHELL_OPTIONS: CreateShellOptions = {
  log: true,
  spawnOptions: DEFAULT_SPAWN_OPTIONS,
};

export const createShell = ({
  log,
  spawnOptions,
} = DEFAULT_SHELL_OPTIONS): Shell => {
  let childProcess: ChildProcess | null = null;
  return {
    childProcess,
    async run(commandString) {

      if (childProcess) {
        throw new Error("Only one command per shell.");
      }

      let cmd: string;
      let args: string[];

      switch (process.platform) {
        case "win32":
          cmd = "cmd.exe";
          args = ["/d", "/s", "/c", commandString];
          break;

        default:
          const cmdParts = commandString.split(" ");
          cmd = cmdParts[0];
          args = cmdParts.slice(1);
          break;
      }

      if (log) {
        // eslint-disable-next-line no-console
        console.log(chalk.dim(`\n$ ${commandString}\n`));
      }

      return await new Promise<SpawnResult>(
        (resolve, reject) => {
          childProcess = spawn(cmd, args, spawnOptions);
          let stdout = "";
          let stderr = "";

          if (!childProcess) {
            throw new Error("Child process was not set.");
          }

          childProcess.stdout?.on("data", (data) => stdout += data);
          childProcess.stderr?.on("data", (data) => stderr += data);

          const resolveResult = (code: number) => {
            childProcess = null;
            const spawnResult = {
              code,
              stdout,
              stderr,
            };

            if (code === 0) {
              resolve(spawnResult);
            } else if (code === 1 && !WINDOWS) {
              resolve(spawnResult);
            } else {
              reject(spawnResult);
            }
          };

          childProcess.on("close", resolveResult);
          childProcess.on("exit", resolveResult);
        }
      );
    },

    async kill(signal = "SIGKILL") {
      if (childProcess?.pid) {
        /**
         * In Windows, we need to hack in a small delay.
         */
        if (WINDOWS) {
          execSync(`taskkill /pid ${childProcess.pid} /t /f`);
          return await new Promise((resolve) => setTimeout(resolve, 1200));
        } else {
          process.kill(-childProcess.pid, signal);
        }
      }

      return true;
    }
  };
};

export * from "./types";