// Integratsion testlarni ketma-ket ishga tushiradi. Backend server ishlab turishi kerak (npm run dev).
//   npm test            — asosiy testlar (OpenAI kerak emas)
//   npm test -- --ai    — AI testlari ham (OPENAI_API_KEY va hisobda mablag' kerak)
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const withAi = process.argv.includes("--ai");
const files = fs
  .readdirSync(__dirname)
  .filter((f) => f.endsWith(".test.js") && (withAi || !f.startsWith("ai-")))
  .sort();

let failed = 0;
let passed = 0;
for (const file of files) {
  const res = spawnSync(process.execPath, [path.join(__dirname, file)], { encoding: "utf8", timeout: 5 * 60 * 1000 });
  const out = `${res.stdout || ""}${res.stderr || ""}`;
  const ok = (out.match(/^OK/gm) || []).length;
  const bad = (out.match(/^FAIL/gm) || []).length;
  passed += ok;
  const status = res.status === 0 && bad === 0 ? "✓" : "✗";
  if (status === "✗") failed++;
  console.log(`${status} ${file.padEnd(28)} ${ok} ta o'tdi${bad ? `, ${bad} ta xato` : ""}`);
  if (status === "✗") console.log(out.split("\n").filter((l) => /^FAIL|Error|error/.test(l)).slice(0, 15).map((l) => "    " + l).join("\n"));
}
console.log(`\nJami: ${passed} ta tekshiruv o'tdi, ${failed} ta faylda xato`);
process.exit(failed ? 1 : 0);
