/**
 * Node ESM resolve hook: lets a specifier without an extension find its
 * TypeScript source, the way Vite's bundler does.
 *
 * The app is written for `moduleResolution: bundler`, so imports like
 * `./ipUtils` carry no extension. Node's resolver requires one, which would
 * otherwise stop any test from importing a module that has a runtime import.
 *
 * Registered via `node --import ./scripts/ts-resolve.mjs <test file>`.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      try {
        return await nextResolve(`${specifier}.ts`, context);
      } catch {
        // Import folder (mis. '../rules') -> folder/index.ts, seperti bundler.
        return await nextResolve(`${specifier.replace(/\/$/, '')}/index.ts`, context);
      }
    }
    throw err;
  }
}
