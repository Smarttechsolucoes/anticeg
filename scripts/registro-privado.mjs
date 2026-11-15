// REGISTRO DURÁVEL E PRIVADO das alterações feitas por scripts de correção: um bucket PRIVADO do Storage do próprio Supabase do projeto (acesso só com a chave de serviço; sem URL pública).
// O log do GitHub é PÚBLICO e expira; este registro guarda valores anteriores, evidências e o necessário para reverter. NUNCA imprima o conteúdo no log.
export const BUCKET = 'auditoria-privada';

export async function garantirBucket(sb) {
  const { data: b } = await sb.storage.getBucket(BUCKET);
  if (b) { if (b.public) throw new Error(`o bucket ${BUCKET} está PÚBLICO: recusado (nada foi gravado)`); return 'existente (privado)'; }
  const { error } = await sb.storage.createBucket(BUCKET, { public: false });
  if (error) throw new Error(`não consegui criar o bucket privado ${BUCKET}: ${error.message}`);
  const { data: c } = await sb.storage.getBucket(BUCKET);
  if (!c || c.public) throw new Error(`o bucket ${BUCKET} não ficou privado: recusado`);
  return 'criado (privado)';
}

// grava e CONFERE lendo de volta; qualquer divergência vira erro (o chamador não pode gravar no banco sem este registro)
export async function gravarRegistro(sb, caminho, objeto) {
  const estado = await garantirBucket(sb);
  const texto = JSON.stringify(objeto, null, 2);
  const { error } = await sb.storage.from(BUCKET).upload(caminho, new Blob([texto], { type: 'application/json' }), { contentType: 'application/json', upsert: false });
  if (error) throw new Error(`não consegui gravar o registro ${caminho}: ${error.message}`);
  const { data, error: e2 } = await sb.storage.from(BUCKET).download(caminho);
  if (e2 || !data) throw new Error(`gravei mas não consegui reler ${caminho}: ${e2?.message || 'vazio'}`);
  if ((await data.text()) !== texto) throw new Error(`o registro ${caminho} lido de volta difere do gravado`);
  return { caminho, bytes: texto.length, bucket: estado };
}

export async function lerRegistro(sb, caminho) {
  const { data, error } = await sb.storage.from(BUCKET).download(caminho);
  if (error || !data) throw new Error(`não consegui ler o registro ${caminho}: ${error?.message || 'vazio'}`);
  return JSON.parse(await data.text());
}

export async function listarRegistros(sb, prefixo = 'correcoes') {
  const { data, error } = await sb.storage.from(BUCKET).list(prefixo, { limit: 200, sortBy: { column: 'name', order: 'asc' } });
  if (error) throw new Error(`não consegui listar ${prefixo}: ${error.message}`);
  return (data || []).map(o => `${prefixo}/${o.name}`);
}

// o bucket NÃO pode ser alcançado sem a chave de serviço: tenta a URL pública e a listagem com a chave pública (anon) do site, que não é segredo. Espera erro nas duas.
export async function verificarPrivado(url, chaveAnon, caminho) {
  const out = {};
  try { const r = await fetch(`${url}/storage/v1/object/public/${BUCKET}/${caminho}`); out.url_publica = r.status; } catch (e) { out.url_publica = 'erro de rede'; }
  if (chaveAnon) {
    try { const r = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, { method: 'POST', headers: { apikey: chaveAnon, Authorization: `Bearer ${chaveAnon}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: 'correcoes', limit: 5 }) }); const j = await r.json().catch(() => null); out.listagem_anon = `${r.status}${Array.isArray(j) ? ` (${j.length} objeto(s) visível(is))` : ''}`; out.anon_enxerga = r.ok && Array.isArray(j) && j.length > 0; } catch (e) { out.listagem_anon = 'erro de rede'; }
    try { const r = await fetch(`${url}/storage/v1/object/authenticated/${BUCKET}/${caminho}`, { headers: { apikey: chaveAnon, Authorization: `Bearer ${chaveAnon}` } }); out.leitura_anon = r.status; out.anon_le = r.ok; } catch (e) { out.leitura_anon = 'erro de rede'; }
  }
  out.privado = out.url_publica !== 200 && !out.anon_enxerga && !out.anon_le;
  return out;
}
