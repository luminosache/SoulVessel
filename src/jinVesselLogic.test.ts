import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { jinNpcData } from "./jinData";
import { getJinDisguiseFillStage } from "./jinLogic";

const disguiseChoiceId = jinNpcData.round_1.options[1]?.option_id ?? "";
const otherChoiceId = jinNpcData.round_1.options[0]?.option_id ?? "";
const round2ChoiceId = jinNpcData.round_2.options[0]?.option_id ?? "";
const round3ChoiceId = jinNpcData.round_3.options[0]?.option_id ?? "";

assert.equal(getJinDisguiseFillStage("", "", "", disguiseChoiceId), 0);
assert.equal(getJinDisguiseFillStage(otherChoiceId, round2ChoiceId, round3ChoiceId, disguiseChoiceId), 0);
assert.equal(getJinDisguiseFillStage(disguiseChoiceId, "", "", disguiseChoiceId), 1);
assert.equal(getJinDisguiseFillStage(disguiseChoiceId, round2ChoiceId, "", disguiseChoiceId), 2);
assert.equal(getJinDisguiseFillStage(disguiseChoiceId, round2ChoiceId, round3ChoiceId, disguiseChoiceId), 3);

const cssPath = fileURLToPath(new URL("./index.css", import.meta.url));
const css = readFileSync(cssPath, "utf8");

assert.match(css, /\.chengtao-top-row::before/);
assert.match(css, /background-color:\s*#6c7f7f/);
assert.match(css, /height:\s*58px/);
assert.match(css, /pointer-events:\s*none/);
assert.match(css, /\.chengtao-tabs-shell\s*\{[\s\S]*?z-index:\s*5/);

console.log("jin vessel logic tests passed");
