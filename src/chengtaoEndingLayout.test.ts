import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const appPath = fileURLToPath(new URL("./App.tsx", import.meta.url));
const cssPath = fileURLToPath(new URL("./index.css", import.meta.url));
const app = readFileSync(appPath, "utf8");
const css = readFileSync(cssPath, "utf8");

assert.match(app, /onComplete\?:\s*\(\)\s*=>\s*void/);
assert.match(app, /setEndingActionsVisible\(true\)/);
assert.match(app, /currentEnding[\s\S]*?endingActionsVisible[\s\S]*?!isDissipating/);

assert.doesNotMatch(css, /\.chengtao-tabs-shell\s*\{[\s\S]*?margin-top:\s*-/);
assert.match(css, /\.chengtao-main-stage\s*\{[\s\S]*?min-height:\s*calc\(100vh - 156px\)/);
assert.match(css, /\.chengtao-ending-text-scroll\s*\{[\s\S]*?max-height:\s*calc\(100% - 5\.5rem\)/);

console.log("chengtao ending layout tests passed");
