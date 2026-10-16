import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

type Win32ProcessBinding = { creationToken: (pid: number) => string | undefined };
const require = createRequire(import.meta.url);
let binding: Win32ProcessBinding | undefined;

/** Read through the shipped Node-API binding. A broken installation is not an unreadable PID. */
export function nativeWin32CreationToken(pid: number): string | undefined {
  if (process.platform !== "win32" || (process.arch !== "x64" && process.arch !== "arm64"))
    throw new Error(`Windows creation identity is unsupported on ${process.platform}/${process.arch}`);
  if (binding === undefined) {
    const path = new URL(`../build/Release/win32-${process.arch}/creation.node`, import.meta.url);
    let loaded: unknown;
    try { loaded = require(fileURLToPath(path)); }
    catch (cause) { throw new Error("could not load the shipped Windows creation identity binding; reinstall this version", { cause }); }
    if (loaded === null || typeof loaded !== "object" || !("creationToken" in loaded) || typeof loaded.creationToken !== "function")
      throw new Error("the shipped Windows creation identity binding has no creationToken function");
    binding = loaded as Win32ProcessBinding;
  }
  return binding.creationToken(pid);
}
