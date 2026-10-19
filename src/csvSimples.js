// Leitor de CSV (RFC 4180): campos entre aspas, aspas duplicadas, vírgulas e quebras de linha dentro do campo.
export function lerCSV(texto) {
  const t = String(texto || "").replace(/^﻿/, "");
  const linhas = [];
  let linha = [], campo = "", aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
      } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ",") { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      linhas.push(linha); linha = [];
    } else campo += c;
  }
  if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

// Acha o cabeçalho real (primeira linha que tem a coluna "ABA") e devolve { colunas, registros }.
export function lerPlanilha(texto, marcador = "ABA") {
  const linhas = lerCSV(texto);
  const idx = linhas.findIndex(l => l.some(c => String(c).includes(marcador)));
  if (idx < 0) throw new Error("Cabeçalho da planilha não encontrado");
  const colunas = linhas[idx].map(c => String(c).trim());
  const registros = linhas.slice(idx + 1)
    .filter(l => l.some(c => String(c).trim() !== ""))
    .map(l => Object.fromEntries(colunas.map((nome, i) => [nome, l[i] ?? ""])));
  return { colunas, registros };
}
