/**
 * start.ts — Process wrapper for main.ts that handles @reboot.
 *
 * Runs main.ts as a subprocess. If main.ts exits with code 75 (reboot request),
 * it automatically restarts it. Any other exit code stops the wrapper.
 *
 * Crash loop protection: if main.ts exits with code 75 more than 3 times
 * within 60 seconds, the wrapper stops to prevent infinite restart loops.
 *
 * Usage:
 *   deno run -A --unstable-kv --unstable-net src/start.ts
 */

const REBOOT_EXIT_CODE = 75;
const CRASH_LOOP_MAX = 3;
const CRASH_LOOP_WINDOW_MS = 60_000;

async function run(): Promise<number> {
  const cmd = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "--unstable-kv", "--unstable-net", "src/main.ts"],
    cwd: Deno.cwd(),
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const process = cmd.spawn();
  const status = await process.status;
  return status.code;
}

const rebootTimestamps: number[] = [];

while (true) {
  console.log("[start] Launching main.ts...");
  const code = await run();

  if (code === REBOOT_EXIT_CODE) {
    const now = Date.now();
    rebootTimestamps.push(now);

    // Keep only timestamps within the crash loop window
    while (rebootTimestamps.length > 0 && rebootTimestamps[0] < now - CRASH_LOOP_WINDOW_MS) {
      rebootTimestamps.shift();
    }

    if (rebootTimestamps.length > CRASH_LOOP_MAX) {
      console.error(`[start] CRASH LOOP DETECTED: ${rebootTimestamps.length} reboots in ${CRASH_LOOP_WINDOW_MS / 1000}s. Stopping.`);
      Deno.exit(1);
    }

    console.log("[start] Reboot requested (exit 75). Restarting in 2 seconds...");
    await new Promise((r) => setTimeout(r, 2000));
    continue;
  }

  console.log(`[start] main.ts exited with code ${code}. Stopping.`);
  Deno.exit(code);
}
