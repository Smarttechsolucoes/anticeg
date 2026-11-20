import { useEffect, useMemo, useState } from "react";
import supabase from "./supabase.js";
import { itensDoCeg } from "./joinerAuth.js";
import { termosDe, cegsPorNome, meusItensQueCasam, totaisDosMeus, precoDaLinha, itensDaComunidade } from "./buscaCegsPuro.js";

const mono = "'DM Mono',monospace";
const brl = v => "R$" + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const POR_VEZ = 6;     // quantas CEGs consulta ao mesmo tempo
const LIMITE = 40;     // quantos grupos mostra de cada vez

// itens de todas as CEGs (sem valores de terceiros): carregados uma vez por visita, quando a pessoa começa a buscar
const CACHE = { porCeg: {}, carregando: false, completo: false };

/**
 * Busca em "Resumo CEGs": pelo nome da CEG e pelo nome do item (ex.: SKZOO).
 * - CEGs: as que têm o termo no nome;
 * - Seus itens: as linhas da própria pessoa, com item / frete / taxa RF / multa e o que já foi pago;
 * - Na comunidade: em quais CEGs o item aparece e quantos pedidos tem (sem @, nome nem valor de ninguém).
 */
export default function BuscaCegs({ termo, cegs, meuCog, podeVerMeus, onAbrirCeg }) {
  const termos = useMemo(() => termosDe(termo), [termo]);
  const [, forca] = useState(0);
  const [progresso, setProgresso] = useState({ feitos: Object.keys(CACHE.porCeg).length, total: cegs.length });
  const [meus, setMeus] = useState(null);     // linhas completas da própria pessoa (null = carregando)
  const [mais, setMais] = useState(LIMITE);

  useEffect(() => {
    if (!podeVerMeus || !meuCog) { setMeus([]); return; }
    let vivo = true;
    supabase.from("masterlist").select("*").eq("cog", meuCog)
      .then(({ data }) => { if (vivo) setMeus(Array.isArray(data) ? data.filter(r => !/^disponivel$/i.test(String(r.nome || ""))) : []); });
    return () => { vivo = false; };
  }, [meuCog, podeVerMeus]);

  useEffect(() => {
    if (CACHE.completo || CACHE.carregando) { setProgresso({ feitos: Object.keys(CACHE.porCeg).length, total: cegs.length }); return; }
    CACHE.carregando = true;
    let vivo = true;
    (async () => {
      const fila = cegs.filter(c => !CACHE.porCeg[c]);
      for (let i = 0; i < fila.length; i += POR_VEZ) {
        await Promise.all(fila.slice(i, i + POR_VEZ).map(async c => {
          try { CACHE.porCeg[c] = await itensDoCeg(c); } catch { CACHE.porCeg[c] = []; }
        }));
        if (!vivo) break;
        setProgresso({ feitos: Object.keys(CACHE.porCeg).length, total: cegs.length });
        forca(x => x + 1);
      }
      CACHE.carregando = false;
      CACHE.completo = Object.keys(CACHE.porCeg).length >= cegs.length;
      if (vivo) forca(x => x + 1);
    })();
    return () => { vivo = false; CACHE.carregando = false; };
  }, [cegs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setMais(LIMITE); }, [termo]);

  const nomes = cegsPorNome(cegs, termos);
  const meusAchados = meus ? meusItensQueCasam(meus, termos) : [];
  const tot = totaisDosMeus(meusAchados);
  const comunidade = itensDaComunidade(CACHE.porCeg, termos);
  const buscando = progresso.feitos < progresso.total;
  const vazio = nomes.length === 0 && meusAchados.length === 0 && comunidade.length === 0;

  const caixa = { background: "rgba(245,240,232,.04)", border: "1px solid rgba(245,240,232,.1)", borderRadius: 10, padding: "12px 14px", marginBottom: 10 };
  const titulo = t => <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "2px", color: "rgba(245,240,232,.4)", margin: "18px 0 8px", textTransform: "uppercase" }}>{t}</div>;
  const abrir = c => <button type="button" className="ceg-saiba-btn" onClick={() => onAbrirCeg(c)}>ver CEG →</button>;

  return (
    <div>
      {buscando && <div style={{ fontFamily: mono, fontSize: 10, color: "rgba(245,240,232,.45)", marginBottom: 12 }}>buscando nos itens de todas as CEGs… {progresso.feitos}/{progresso.total}</div>}

      {vazio && !buscando && <div style={{ padding: 40, textAlign: "center", color: "rgba(245,240,232,.35)", fontFamily: mono, fontSize: 12 }}>nada encontrado para “{termo}”</div>}

      {meusAchados.length > 0 && (
        <>
          {titulo(`Seus itens (${meusAchados.length})`)}
          <div style={{ ...caixa, borderColor: "rgba(183,156,255,.25)" }}>
            <div style={{ fontFamily: mono, fontSize: 11, lineHeight: 1.8, color: "rgba(245,240,232,.75)" }}>
              Nos itens encontrados você tem: item <strong style={{ color: "var(--offwhite)" }}>{brl(tot.item)}</strong> · frete <strong style={{ color: "var(--offwhite)" }}>{brl(tot.frete)}</strong> · taxa RF <strong style={{ color: "var(--offwhite)" }}>{brl(tot.rf)}</strong>{tot.multa > 0 && <> · multa <strong style={{ color: "var(--offwhite)" }}>{brl(tot.multa)}</strong></>} = <strong style={{ color: "var(--laranja)" }}>{brl(tot.total)}</strong>
            </div>
          </div>
          {meusAchados.slice(0, mais).map(r => {
            const p = precoDaLinha(r);
            const parte = (rotulo, valor, pago) => valor > 0 ? <span style={{ marginRight: 14 }}>{rotulo} <strong style={{ color: "var(--offwhite)" }}>{brl(valor)}</strong>{pago ? <span style={{ color: "var(--verde)" }}> ✓ pago</span> : ""}</span> : null;
            return (
              <div key={r.id} style={caixa}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{r.nome_do_item || "(sem nome)"}</div>
                    <div style={{ fontFamily: mono, fontSize: 10, color: "rgba(245,240,232,.45)", marginTop: 2 }}>{r.ceg || "—"}{r.status ? ` · ${r.status}` : ""}</div>
                  </div>
                  {abrir(r.ceg)}
                </div>
                <div style={{ fontFamily: mono, fontSize: 11, lineHeight: 1.9, color: "rgba(245,240,232,.55)", marginTop: 8 }}>
                  {parte("Item", p.item, p.pagoItem)}{parte("Frete", p.frete, p.pagoFrete)}{parte("Taxa RF", p.rf, p.pagoRf)}{parte("Multa", p.multa, false)}
                  {p.total > 0 ? <span>Total <strong style={{ color: "var(--laranja)" }}>{brl(p.total)}</strong></span> : <span>sem valores lançados ainda</span>}
                </div>
              </div>
            );
          })}
        </>
      )}

      {nomes.length > 0 && (
        <>
          {titulo(`CEGs (${nomes.length})`)}
          {nomes.slice(0, mais).map(c => (
            <div key={c} style={{ ...caixa, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{c}</div>
              {abrir(c)}
            </div>
          ))}
        </>
      )}

      {comunidade.length > 0 && (
        <>
          {titulo(`Itens nas CEGs (${comunidade.length} CEGs)`)}
          {comunidade.slice(0, mais).map(g => (
            <div key={g.ceg} style={caixa}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{g.ceg} <span style={{ fontFamily: mono, fontSize: 10, color: "rgba(245,240,232,.4)", fontWeight: 400 }}>· {g.pedidos} {g.pedidos === 1 ? "pedido" : "pedidos"}</span></div>
                {abrir(g.ceg)}
              </div>
              {g.itens.slice(0, 8).map(i => (
                <div key={i.nome} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontFamily: mono, fontSize: 11, lineHeight: 1.8, color: "rgba(245,240,232,.65)" }}>
                  <span>☆ {i.nome}</span><span style={{ whiteSpace: "nowrap", color: "rgba(245,240,232,.4)" }}>×{i.qtd}</span>
                </div>
              ))}
              {g.itens.length > 8 && <div style={{ fontFamily: mono, fontSize: 10, color: "rgba(245,240,232,.35)", marginTop: 4 }}>+ {g.itens.length - 8} itens nesta CEG</div>}
            </div>
          ))}
          <div style={{ fontFamily: mono, fontSize: 10, color: "rgba(245,240,232,.3)", lineHeight: 1.6, marginTop: 6 }}>
            Por privacidade, valores de frete, taxa e item de outras pessoas não aparecem; os seus aparecem em “Seus itens”.
          </div>
        </>
      )}

      {(meusAchados.length > mais || nomes.length > mais || comunidade.length > mais) && (
        <button type="button" onClick={() => setMais(m => m + LIMITE)} style={{ marginTop: 10, background: "transparent", border: "1px solid rgba(245,240,232,.2)", color: "rgba(245,240,232,.7)", borderRadius: 6, padding: "8px 16px", fontFamily: mono, fontSize: 11, cursor: "pointer" }}>mostrar mais</button>
      )}
    </div>
  );
}
