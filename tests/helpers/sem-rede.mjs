// Importe ESTE arquivo PRIMEIRO em qualquer teste que toque módulos que falam com o Apps Script ou com o Supabase.
// Troca o fetch global por um que SEMPRE falha: um teste que esquecer de passar um fetch simulado não chega mais ao Apps Script de produção.
export const chamadasBloqueadas = [];
globalThis.fetch = async url => { chamadasBloqueadas.push(String(url)); throw new Error(`REDE REAL BLOQUEADA no teste: ${url}`); };
