// node setup/compare-settings-grammar.mjs <file>
//
// Compares the JSON object a language's settings reader printed for setup/settings-grammar.env with
// setup/settings-grammar.json, so the Node, C# and Java readers cannot drift apart (CONTRACT.md).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const expected = JSON.parse(readFileSync(new URL('./settings-grammar.json', import.meta.url), 'utf8'));
const actual = JSON.parse(readFileSync(process.argv[2], 'utf8'));
assert.deepEqual(actual, expected, 'the settings reader disagrees with setup/settings-grammar.json');
console.log('The settings reader matches setup/settings-grammar.json.');
