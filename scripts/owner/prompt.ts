import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

/** Read a value from env (for automation) or prompt; secret input is never echoed. */
export async function ask(question: string, options: { env?: string; secret?: boolean } = {}): Promise<string> {
  if (options.env && process.env[options.env]) return process.env[options.env] as string;
  if (options.secret) return askHidden(question);
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  const answer = await rl.question(question);
  rl.close();
  return answer;
}

/**
 * Read one line with terminal echo off. Uses raw mode directly rather than
 * patching readline internals, which changed between Node versions.
 */
function askHidden(question: string): Promise<string> {
  if (!stdin.isTTY) {
    throw new Error("Passwords can only be entered in an interactive terminal");
  }
  stdout.write(question);
  return new Promise((resolve) => {
    let value = "";
    const finish = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      stdout.write("\n");
      resolve(value);
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") return finish();
        if (char === "\u0003") {
          stdin.setRawMode(false);
          stdout.write("\n");
          process.exit(130);
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    };
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}
