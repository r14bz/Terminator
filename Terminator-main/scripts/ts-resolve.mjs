/**
 * Registers the TypeScript extensionless-specifier resolve hook.
 *
 *   node --import ./scripts/ts-resolve.mjs scripts/verify-ping.mjs
 *
 * Tests import real .ts sources so they cannot drift from the implementation;
 * this is what lets those sources keep their bundler-style extensionless
 * imports.
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./ts-resolve-hooks.mjs', pathToFileURL(import.meta.dirname + '/'));
