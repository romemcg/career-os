import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

/** Read a value from env (for automation) or prompt; passwords are not echoed. */
export async function ask(question: string, options: { env?: string; secret?: boolean } = {}): Promise<string> {
  if (options.env && process.env[options.env]) return process.env[options.env] as string;
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  if (options.secret) {
    // Suppress echo of typed characters.
    const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
      if (s.startsWith(question)) write.call(rl, s);
    };
  }
  const answer = await rl.question(question);
  rl.close();
  if (options.secret) stdout.write("\n");
  return answer;
}
