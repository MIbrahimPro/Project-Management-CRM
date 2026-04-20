/**
 * Preload via NODE_OPTIONS=--require=./scripts/suppress-build-noise.cjs
 * Filters known third-party warnings that clutter `next build` / server startup.
 */
"use strict";

const origWarn = console.warn;
console.warn = function suppressKnownNoise(...args) {
  const first = args[0];
  if (typeof first === "string") {
    if (
      first.includes("@supabase/supabase-js") &&
      (first.includes("Node.js 18") || first.includes("Node.js 20"))
    ) {
      return;
    }
    if (
      first.includes("Redis server") &&
      first.includes("password was supplied")
    ) {
      return;
    }
  }
  origWarn.apply(console, args);
};
