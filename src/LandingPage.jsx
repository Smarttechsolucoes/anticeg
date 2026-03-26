import { useEffect, useRef, useState } from "react";
import "./LandingPage.css";
import bonequinha from "./assets/bonequinha.png";

const WA = "5524992501917";
const FORMS_URL = "https://forms.gle/vMyjCKG4Dj2yhryP7";

export default function LandingPage({ onEntrar }) {
  const cursorRef = useRef(null);
  const ringRef = useRef(null);
  const [activeMenu, setActiveMenu] = useState("r1");

  useEffect(() => {
    const cursor = cursorRef.current;
    const ring = ringRef.current;
    const move = e => {
      cursor.style.left = e.clientX + "px";
      cursor.style.top = e.clientY + "px";
      ring.style.left = e.clientX + "px";
      ring.style.top = e.clientY + "px";
    };
    document.addEventListener("mousemove", move);
    const interactives = document.querySelectorAll(".lp a, .lp button, .lp input, .lp select, .lp textarea");
    interactives.forEach(el => {
      el.addEventListener("mouseenter", () => { cursor.style.width="6px"; cursor.style.height="6px"; ring.style.width="52px"; ring.style.height="52px"; });
      el.addEventListener("mouseleave", () => { cursor.style.width="12px"; cursor.style.height="12px"; ring.style.width="36px"; ring.style.height="36px"; });
    });
    return () => document.removeEventListener("mousemove", move);
  }, []);

  const regras = [
    { id:"r1", titulo:"Claim", itens:[
      "É permitida apenas UMA pessoa te ajudando a dar claims nos itens.",
      "No momento da claim, deve estar claramente sinalizado para quem é o photocard. Caso não esteja, o item será considerado seu.",
      "Itens considerados seus só poderão ser repassados mediante pagamento integral.",
    ]},
    { id:"r2", titulo:"Infos Gerais", itens:[
      "Sempre buscamos trazer merchs, SKZOOs, itens de pop-up e photocards do SKZ com melhor preço e variedade.",
      "Às vezes também rolam caixinhas do Mercari, POCA, TaoBao e outros lugares!",
      "Assim que os itens chegam na warehouse/proxy, já solicito envio — não fazemos CEG longa.",
      "Menores de idade não são permitidos.",
      "Você pode convidar amigxs confiáveis, mas evitem pessoas totalmente desconhecidas.",
    ]},
    { id:"r3", titulo:"Pagamentos & Taxas", itens:[
      "A Nanda faz o pagamento com dinheiro próprio/cartão de crédito — por isso vocês ganham prazo maior para pagar.",
      "Taxa de atraso: R$1 por dia por item, somada no momento do pagamento pendente.",
      "Taxa de embalagem de R$2,50 para até 6 photocards, podendo variar conforme os itens.",
      "Pode existir taxa da warehouse/proxy — sempre serão comunicadas.",
      "O comprovante de pagamento deve ser enviado no formulário de pagamento.",
      "Reembolso só em caso de cancelamento da CEG inteira — imediato e integral.",
      "Quem estiver com pagamento atrasado ou atrasar 3 prazos consecutivos em 30 dias não poderá dar claim até regularizar.",
    ]},
    { id:"r4", titulo:"Repasse & Atraso", itens:[
      "Você pode repassar seus itens para membros da comunidade ANTIGOM. Fora da comunidade, só após pagamento integral.",
      "Pagamentos com mais de 15 dias de atraso (item/taxa/frete inter) serão considerados abandono e o item será revendido. Sem reembolso.",
      "Atrasos não comunicados ou +5 dias entrarão na lista de NÃO PAGANTES.",
      "Com 3 atrasos em 2 meses, as claims serão bloqueadas até regularização.",
      "Itens com 20 dias corridos de atraso sem justificativa prévia serão repassados. Sem chance de recompra.",
    ]},
    { id:"r5", titulo:"Envios", itens:[
      "Taxa inter: prazo de até 4 dias para pagamento. Taxa RF: prazo de 7 dias.",
      "Frete nacional: a combinar. Armazenamento gratuito por até 1 mês se houver outra CEG a caminho.",
      "Após 30 dias sem CEG, taxa de R$30/mês de armazenamento. Com 60 dias sem solicitação, item considerado ABANDONO.",
      "Envios nacionais acontecem em 7 dias úteis pela plataforma NUVEMSHOP.",
      "O valor da declaração sempre será o valor integral do produto para cobertura do seguro.",
    ]},
    { id:"r6", titulo:"Reembolsos", itens:[
      "Situações de calote de seller não serão reembolsadas. Todas as sellers têm boas avaliações, mas transações internacionais têm riscos.",
      "Não há reembolso em caso de roubo ou perda do objeto.",
      "Reembolso possível em caso de má embalagem comprovada por vídeo de abertura sem cortes.",
      "Compradores sensíveis a pequenos defeitos estéticos (amassados leves, pressmarks) não devem participar de CEGs.",
    ]},
  ];

  const faq = [
    ["Quem organiza?", "Nanda."],
    ["Posso chamar amigos?", "Sim, desde que sejam confiáveis e dentro da comunidade."],
    ["Menores podem participar?", "Não."],
    ["Preciso pagar à vista?", "Você pode pagar no PIX ou cartão de crédito."],
    ["Posso cancelar meu pedido?", "A partir do momento em que o item está confirmado, não é possível cancelar."],
    ["Como funcionam os repasses?", "Me mande mensagem pedindo autorização. Só para membros da ANTIGOM."],
    ["E se a CEG for cancelada?", "Reembolso total."],
    ["Quais formas de envio pro Brasil?", "Correios, Mini Envio, Superfrete ou Jadlog."],
    ["Posso retirar pessoalmente?", "Sim, se estivermos na mesma região."],
  ];

  return (
    <div className="lp">
      <div className="lp-cursor" ref={cursorRef} />
      <div className="lp-cursor-ring" ref={ringRef} />

      {/* NAV */}
      <nav className="lp-nav">
        <a className="lp-nav-logo" href="#">ANTI<span>CEG</span></a>
        <ul className="lp-nav-links">
          <li><a href="#lp-regras">Regras</a></li>
          <li><a href="#lp-antimail">Antimail</a></li>
          <li><a href="#lp-pagamento">Pagar</a></li>
          <li><a href={`https://wa.me/${WA}`} target="_blank" rel="noopener noreferrer">Comunidade</a></li>
          <li><a href="#" className="lp-nav-cta" onClick={e => { e.preventDefault(); onEntrar(); }}>Portal →</a></li>
        </ul>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <img src={bonequinha} alt="antigom" className="lp-bonequinha-hero" />
        <div className="lp-hero-center">
          <div className="lp-hero-left">
            <div className="lp-hero-tag">anticeg — compras em grupo · SKZ & mais</div>
            <h1 className="lp-h1"><span className="ao">ANTI</span><span className="ag">GOM</span></h1>
            <p className="lp-hero-sub">O lugar para você organizar seus trequinhos da anticomu. Consulte seus itens, acompanhe envios e gerencie pagamentos — e sim, você pode comprar na anti-store.</p>
            <div className="lp-hero-actions">
              <button className="lp-btn-primary" onClick={onEntrar}>Acessar o portal</button>
              <a href="#lp-regras" className="lp-btn-outline">Ver as regras</a>
            </div>
          </div>
          <div className="lp-hero-card">
            <div className="lp-card-label">// acesso rápido</div>
            <input className="lp-card-input" type="text" placeholder="seu COG ou e-mail" />
            <button className="lp-card-btn" onClick={onEntrar}>ACESSAR PORTAL →</button>
            <div style={{ marginTop:20, fontFamily:"'DM Mono',monospace", fontSize:11, color:"rgba(245,240,232,.3)", lineHeight:1.6 }}>
              Use o mesmo COG ou e-mail cadastrado na anticeg.
            </div>
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div className="lp-ticker">
        <div className="lp-ticker-inner">
          <span>ANTICEG</span><span>COMPRAS EM GRUPO</span><span>ANTICOMU</span><span>SKZ IMPORTS</span><span>ANTIMAIL</span><span>ANTIJOINERS</span><span>ANTI-STORE</span><span>ANTIGOM</span><span>ANTICEG</span><span>COMPRAS EM GRUPO</span><span>ANTICOMU</span><span>SKZ IMPORTS</span><span>ANTIMAIL</span><span>ANTIJOINERS</span><span>ANTI-STORE</span><span>ANTIGOM</span>
        </div>
      </div>

      {/* ANTIMAIL */}
      <section className="lp-section lp-antimail" id="lp-antimail">
        <div className="lp-section-header">
          <div>
            <div className="lp-section-num">// 01</div>
            <h2 className="lp-h2">ANTI<span style={{ color:"#BAFF39" }}>MAIL</span></h2>
          </div>
          <p className="lp-section-desc">Status dos envios nacionais e rastreamento dos pacotes da anticomu.</p>
        </div>
        <div className="lp-mail-grid">
          <div className="lp-mail-card">
            <div className="lp-m-label">Envios nacionais</div>
            <div className="lp-m-title">NUVEMSHOP</div>
            <div className="lp-m-info">Todos os envios nacionais são feitos pela plataforma Nuvemshop em até 7 dias úteis. Você recebe o código de rastreio no grupo e pelo portal.</div>
            <div className="lp-m-track">↗ Rastreie pelo portal com seu COG</div>
          </div>
          <div className="lp-mail-card">
            <div className="lp-m-label">Transportadoras</div>
            <div className="lp-m-title">OPÇÕES</div>
            <div className="lp-m-info">Enviamos via Correios, Mini Envio, Superfrete ou Jadlog — a escolha varia conforme peso e região.</div>
            <div className="lp-m-track">↗ Armazenamento grátis por até 1 mês</div>
          </div>
          <div className="lp-mail-card">
            <div className="lp-m-label">Declaração</div>
            <div className="lp-m-title">SEGURO INCLUSO</div>
            <div className="lp-m-info">O valor declarado sempre será o valor integral do produto para cobertura total do seguro do frete nacional.</div>
            <div className="lp-m-track" style={{ color:"#FF5C1A" }}>↗ Abra o pacote em vídeo sem cortes</div>
          </div>
          <div className="lp-mail-card" style={{ background:"rgba(186,255,57,.04)", border:"1px dashed rgba(186,255,57,.2)" }}>
            <div className="lp-m-label">Dúvidas sobre envio?</div>
            <div className="lp-m-title" style={{ color:"#BAFF39" }}>FALE COM A NANDA</div>
            <div className="lp-m-info">Qualquer questão sobre frete, rastreio ou armazenamento — chama no WhatsApp da comunidade.</div>
            <a href={`https://wa.me/${WA}`} target="_blank" rel="noopener noreferrer" className="lp-btn-primary" style={{ marginTop:8, fontSize:11, padding:"10px 20px" }}>💬 WhatsApp →</a>
          </div>
        </div>
      </section>

      {/* BIG DIVIDER */}
      <div className="lp-big-divider">
        <div className="lp-big-divider-text">ANTIJOINERS&nbsp;&nbsp;&nbsp;ANTICEG&nbsp;&nbsp;&nbsp;ANTICOMU&nbsp;&nbsp;&nbsp;ANTIMAIL&nbsp;&nbsp;&nbsp;ANTIGOM&nbsp;&nbsp;&nbsp;ANTI-STORE&nbsp;&nbsp;&nbsp;ANTIJOINERS&nbsp;&nbsp;&nbsp;ANTICEG&nbsp;&nbsp;&nbsp;ANTICOMU&nbsp;&nbsp;&nbsp;ANTIMAIL&nbsp;&nbsp;&nbsp;ANTIGOM&nbsp;&nbsp;&nbsp;ANTI-STORE&nbsp;&nbsp;&nbsp;</div>
      </div>

      {/* REGRAS */}
      <section className="lp-section lp-regras" id="lp-regras">
        <div className="lp-section-header">
          <div>
            <div className="lp-section-num">// 02</div>
            <h2 className="lp-h2">REGRAS <span style={{ color:"#C9A8F0" }}>DA COMU</span></h2>
          </div>
          <p className="lp-section-desc">Leia com atenção antes de entrar em qualquer anticeg.</p>
        </div>
        <div className="lp-regras-wrap">
          <nav className="lp-regras-menu">
            {regras.map(r => (
              <a key={r.id} href="#lp-regras" className={activeMenu === r.id ? "active" : ""} onClick={e => { e.preventDefault(); setActiveMenu(activeMenu === r.id ? null : r.id); }}>{r.titulo} <span style={{ marginLeft:"auto", opacity:.5 }}>{activeMenu === r.id ? "▲" : "▼"}</span></a>
            ))}
            <a href="#lp-regras" className={activeMenu === "faq" ? "active" : ""} onClick={e => { e.preventDefault(); setActiveMenu(activeMenu === "faq" ? null : "faq"); }}>FAQ <span style={{ marginLeft:"auto", opacity:.5 }}>{activeMenu === "faq" ? "▲" : "▼"}</span></a>
            <a href="#lp-regras" className={activeMenu === "contato" ? "active" : ""} onClick={e => { e.preventDefault(); setActiveMenu(activeMenu === "contato" ? null : "contato"); }}>Contato <span style={{ marginLeft:"auto", opacity:.5 }}>{activeMenu === "contato" ? "▲" : "▼"}</span></a>
          </nav>
          <div>
            {regras.map(r => activeMenu === r.id && (
              <div className="lp-regra-block" key={r.id}>
                <h3>{r.titulo.toUpperCase()}</h3>
                <ul>{r.itens.map((item, j) => <li key={j}>{item}</li>)}</ul>
              </div>
            ))}
            {activeMenu === "faq" && (
              <div className="lp-regra-block">
                <h3>PERGUNTAS FREQUENTES</h3>
                {faq.map(([p, r], i) => (
                  <div key={i} style={{ marginBottom:16 }}>
                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:13, color:"#F5F0E8", marginBottom:4 }}>→ {p}</div>
                    <div style={{ fontSize:13, color:"rgba(245,240,232,.6)", lineHeight:1.7, paddingLeft:16 }}>{r}</div>
                  </div>
                ))}
              </div>
            )}
            {activeMenu === "contato" && (
              <div className="lp-regra-block">
                <h3>CONTATO</h3>
                <p>Dúvidas, problemas ou solicitações? Chama a Nanda diretamente no WhatsApp da comunidade.</p>
                <div className="lp-highlight-block">Ao participar de qualquer anticeg, você concorda com todos os termos e regras desta página.</div>
                <a href={`https://wa.me/${WA}`} target="_blank" rel="noopener noreferrer" className="lp-btn-primary" style={{ marginTop:16, fontSize:11 }}>💬 WhatsApp →</a>
              </div>
            )}
            {!activeMenu && <div style={{ color:"rgba(245,240,232,.3)", fontFamily:"'DM Mono',monospace", fontSize:12, paddingTop:8 }}>← selecione um tópico para expandir</div>}
          </div>
        </div>
      </section>

      {/* PAGAMENTO */}
      <section className="lp-section lp-pagamento" id="lp-pagamento">
        <div className="lp-section-header">
          <div>
            <div className="lp-section-num">// 03</div>
            <h2 className="lp-h2">PAGA<span style={{ color:"#BAFF39" }}>MENTO</span></h2>
          </div>
          <p className="lp-section-desc">Confirme seu pagamento para garantir seus itens na anticeg.</p>
        </div>
        <div className="lp-pag-grid">
          <div className="lp-pag-card">
            <h3>DADOS PIX</h3>
            <div className="lp-pix-box">
              <div className="lp-pix-label">Chave PIX</div>
              <div className="lp-pix-key" style={{ fontSize:18 }}>de1a489d-db81-4864-a8cf-74cdd79d9cdc</div>
              <div className="lp-pix-val">Fernanda Gomes Medeiros · Mercado Pago</div>
            </div>
            <div>
              <div className="lp-pix-label" style={{ marginBottom:12 }}>Atenção</div>
              <div className="lp-note-item">No campo "descrição" do PIX, informe seu COG e o número da CEG.</div>
              <div className="lp-note-item">Envie o comprovante pelo formulário — não pelo WhatsApp.</div>
              <div className="lp-note-item">Taxa de atraso: R$1 por dia por item. Pague em dia!</div>
              <div className="lp-note-item">Dúvidas sobre o valor? Acesse o portal e consulte seus itens antes de pagar.</div>
            </div>
          </div>
          <div className="lp-pag-card">
            <h3>COMPROVANTE</h3>
            <p style={{ fontSize:14, color:"rgba(245,240,232,.5)", marginBottom:28, lineHeight:1.6 }}>
              Envie seu comprovante pelo formulário abaixo. Não esqueça de incluir seu COG e o número da CEG.
            </p>
            <a href={FORMS_URL} target="_blank" rel="noopener noreferrer" className="lp-btn-primary" style={{ width:"100%", justifyContent:"center", fontSize:14, padding:18, marginBottom:20 }}>
              ABRIR FORMULÁRIO DE PAGAMENTO →
            </a>
            <div className="lp-note-item">Pagamento via cartão de crédito? Use o mesmo formulário e selecione a opção cartão.</div>
            <div className="lp-note-item">Após envio do comprovante, aguarde confirmação da Nanda no grupo.</div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div>
          <div className="lp-footer-logo">ANTI<span>CEG</span></div>
          <p className="lp-footer-desc">Compras em grupo de kpop organizadas pela Nanda para a anticomu. Com amor, organização e muito caos controlado.</p>
          <img src={bonequinha} alt="antigom" className="lp-bonequinha-footer" />
        </div>
        <div className="lp-footer-col">
          <h4>Navegação</h4>
          <ul>
            <li><a href="#lp-antimail">Antimail</a></li>
            <li><a href="#lp-regras">Regras da comu</a></li>
            <li><a href="#lp-pagamento">Pagamento</a></li>
            <li><a href="#" onClick={e => { e.preventDefault(); onEntrar(); }}>Acessar o Portal</a></li>
          </ul>
        </div>
        <div className="lp-footer-col">
          <h4>Anticomu</h4>
          <ul>
            <li><a href={`https://wa.me/${WA}`} target="_blank" rel="noopener noreferrer">WhatsApp da comunidade</a></li>
            <li><a href={FORMS_URL} target="_blank" rel="noopener noreferrer">Formulário de pagamento</a></li>
            <li><a href="#" onClick={e => { e.preventDefault(); onEntrar(); }}>Anti-Store</a></li>
          </ul>
        </div>
      </footer>
      <div className="lp-footer-bottom">
        <span>© 2025 ANTICEG — Nanda · antigom</span>
        <span>COMPRAS EM GRUPO · ANTICOMU · KPOP</span>
      </div>
    </div>
  );
}
