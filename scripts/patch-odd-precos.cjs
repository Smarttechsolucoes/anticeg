// Uso único: preenche os preços do ODD & FRESH POP-UP e tira os avisos "valores a definir". Aplica sobre src/App.jsx.
const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "..", "src", "App.jsx");
const raw = fs.readFileSync(p, "utf8");
const CR = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");
function rep(a, b) {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(n + " :: " + a.slice(0, 80));
  s = s.replace(a, () => b);
}
const precos = {
  "HOODIE": 395, "LONG SLEEVE": 265, "T-SHIRT SEOUL VER.": 215, "SWEAT PANTS": 378, "WINDBREAKER": 415,
  "BALL CAP SEOUL VER.": 180, "BANDANA SEOUL VER.": 180, "TOTE BAG": 305, "POSTER BOOK": 92,
  "SKZOO SECRET MINI CHARM": 52, "PHOTO SET": 68, "ACRYLIC STOPPER": 92, "PHOTOCARD HOLDER SET": 58,
  "SKZOO BOWL": 90, "SKZOO CAN BADGE HOLDER SET": 105, "SKZOO CHARM HOOK": 60, "SKZOO FIGURE PHONE STAND": 95,
  "SKZOO FIGURE TUMBLER": 245, "SKZOO MOOD LAMP": 220, "SKZOO PLUSH MINI CAKE VER.": 140,
  "CAKE POUCH": 135, "RUG": 200, "SCRUBBER": 180,
};
const renomear = { "CAKE POUCH": "SKZOO CAKE POUCH", "RUG": "SKZOO RUG", "SCRUBBER": "SKZOO SCRUBBER" };
for (const [id, v] of Object.entries(precos)) {
  const a = `{ id: "${id}", foto: ODD_PU + `;
  const i = s.indexOf(a);
  if (i < 0 || s.indexOf(a, i + 1) >= 0) throw new Error("item " + id);
  const fim = s.indexOf("preco: null", i);
  if (fim < 0 || fim - i > 120) throw new Error("preco " + id);
  s = s.slice(0, fim) + "preco: " + v + s.slice(fim + "preco: null".length);
  if (renomear[id]) s = s.slice(0, i) + `{ id: "${renomear[id]}", foto: ODD_PU + ` + s.slice(i + a.length);
}
rep(`tags: ["PEDIDOS ATÉ 09/NOV", "VALORES A DEFINIR"],`, `tags: ["PEDIDOS ATÉ 09/NOV"],`);
rep(`infos: ["Pedidos aceitos até: 09 de novembro", "Valores a definir", "Roupas:`, `infos: ["Pedidos aceitos até: 09 de novembro", "Roupas:`);
rep(`tags: ["Pedidos até 09/11", "Valores a definir"],`, `tags: ["Pedidos até 09/11"],`);
fs.writeFileSync(p, CR ? s.replace(/\n/g, "\r\n") : s);
console.log("ok");
