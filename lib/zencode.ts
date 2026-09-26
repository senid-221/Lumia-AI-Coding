import { spawn } from "node:child_process";

export type ZencoderRuntimeResult = {
  text: string;
  exitCode: number | null;
};

const runtimeCommand = () => process.env.ZENCODER_RUNTIME_COMMAND || "zen";

export async function runZencoderRuntime(
  prompt: string,
  cwd: string,
  onOutput?: (chunk: string) => void
): Promise<ZencoderRuntimeResult> {
  const command = runtimeCommand();

  return await new Promise((resolve, reject) => {
    const child = spawn(command, [prompt], {
      cwd,
      env: {
        ...process.env,
        // The runtime itself owns authentication. Lumia must not send
        // Zencoder credentials to an undocumented REST endpoint.
      },
      shell: process.platform === "win32",
    });

    let output = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      output += text;
      onOutput?.(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      onOutput?.(text);
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(
          new Error(
            `Zencoder runtime not installed. Configure ZENCODER_RUNTIME_COMMAND or install the official Zen CLI/runtime on the Lumia worker. Lumia no longer sends Zencoder API keys to the undocumented api.z.ai endpoint.`
          )
        );
        return;
      }
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Zencoder runtime exited with code ${code ?? "unknown"}.${stderr ? ` ${stderr.slice(-2000)}` : ""}`
          )
        );
        return;
      }

      resolve({
        text: output.trim() || "Zencoder runtime completed the task.",
        exitCode: code,
      });
    });
  });
}

// Kept as a compatibility guard for old callers. We deliberately do not
// construct an OpenAI-compatible client for Zencoder.
export function getZencodeClient(): never {
  throw new Error(
    "The old Zencoder REST adapter was removed. Use the official Zen CLI/runtime through runZencoderRuntime."
  );
}
