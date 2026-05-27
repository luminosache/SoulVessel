import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { jinNpcData } from "./jinData";

const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("./index.css", import.meta.url), "utf8");

assert.match(appSource, /isJinIntroPlaying/);
assert.match(appSource, /setIsJinIntroPlaying/);
assert.match(appSource, /jin-cinematic-intro/);
assert.match(appSource, /cinematic-title/);
assert.match(appSource, /function JinMinimalVase/);
assert.match(appSource, /className="jin-panel-vase-wrap jin-panel-vase-wrap-left"/);
assert.match(appSource, /className="jin-center-vase-shadow jin-center-vase-shadow-right"/);
assert.match(appSource, /fill="#000000"/);
assert.doesNotMatch(appSource, /jin-intro-vase-clay|jin-intro-vase-core/);
assert.doesNotMatch(appSource, /src="\/soul-vase\.png"/);
assert.match(appSource, /jin-warning-mode/);
assert.match(appSource, /为了圣战|涓轰簡鍦ｆ垬/);

assert.match(cssSource, /@keyframes jin-vase-left-split/);
assert.match(cssSource, /@keyframes jin-vase-right-split/);
assert.match(cssSource, /@keyframes jin-title-ash-fade/);
assert.match(cssSource, /\.jin-panel-vase-wrap/);
assert.match(cssSource, /\.jin-center-vase-shadow/);
assert.match(cssSource, /\.jin-warning-mode/);
assert.match(cssSource, /\.tainted-state/);
assert.match(cssSource, /#d8b8a2/);

const pathsMissingArtifacts = jinNpcData.paths
  .filter((path) => !Object.hasOwn(path, "artifacts"))
  .map((path) => path.path_id);
assert.deepEqual(pathsMissingArtifacts, []);

console.log("jin presentation checks passed");
