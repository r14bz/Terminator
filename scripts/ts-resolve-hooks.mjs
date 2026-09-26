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
      return await nextResolve(`${specifier}.ts`, context);
    }
    throw err;
  }
}
