/* =========================================================================
   Meu Caixa — protótipo de app de finanças (HTML/CSS/JS puro, sem build)
   Estrutura:
     1. Tokens de cor
     2. Dados de exemplo (contas, transações, extrato p/ conciliação, categorias)
     3. Helpers (formatação, ícones SVG)
     4. Componentes de UI (badge, valor monetário, KPI)
     5. Gráficos desenhados em SVG (barras, rosca, área)
     6. Telas (views) — cada aba é uma função que devolve HTML
     7. Modal "nova transação" — campos mudam conforme o tipo
     8. Estado + renderização + eventos
   Tudo é mock. A "sugestão" da conciliação aqui é fixa; num app real
   viria de regras/histórico/ML sobre a descrição do extrato.
   ========================================================================= */

/* ---------- 1. tokens ---------- */
const C = {
  receita: "#2E9E6B",   // pinho — entra
  despesa: "#C24A38",   // oxblood — sai
  transfer: "#7C89A0",  // ardósia — neutro
  reembolso: "#9070B4", // violeta discreto
  patrimonio: "#B0863A",// latão
  brand: "#A8823C",     // latão (acento único)
};
const donutPalette = ["#A8823C", "#2E9E6B", "#7C89A0", "#C24A38", "#9070B4", "#5E7D6A", "#B9A24B", "#8A6D4F"];

/* dados reais do Orçamento Fácil (dados.js) — cai nos mocks se ausente */
const OF = (typeof window !== "undefined" && window.OF_DATA) ? window.OF_DATA : null;
const REF_LABEL = OF ? OF.refMonthLabel : "Julho";

/* ---------- 2. dados ---------- */
const accounts = OF ? OF.accounts : [
  { id: "cc", nome: "Conta Corrente", sub: "Nubank", tipo: "banco", saldo: 8450, grupo: "fin" },
  { id: "pp", nome: "Poupança", sub: "Caixa", tipo: "banco", saldo: 22300, grupo: "fin" },
  { id: "cred", nome: "Cartão de Crédito", sub: "Fatura em aberto", tipo: "cartao", saldo: -3180, grupo: "fin" },
  { id: "cart", nome: "Carteira", sub: "Dinheiro", tipo: "dinheiro", saldo: 320, grupo: "fin" },
  { id: "inv", nome: "Investimentos", sub: "Tesouro & CDB", tipo: "invest", saldo: 45700, grupo: "fin" },
  { id: "carro", nome: "Carro — Honda City", sub: "Alocação de patrimônio", tipo: "patrimonio", saldo: 78000, grupo: "pat", alocado: 82000, custo: -4000 },
];

const monthly = OF ? OF.monthly : [
  { mes: "Fev", receita: 14200, despesa: 9800 },
  { mes: "Mar", receita: 15100, despesa: 10400 },
  { mes: "Abr", receita: 13800, despesa: 11200 },
  { mes: "Mai", receita: 16500, despesa: 9600 },
  { mes: "Jun", receita: 15300, despesa: 12100 },
  { mes: "Jul", receita: 15800, despesa: 8900 },
];

const patrimonioSerie = OF ? OF.patrimonioSerie : [
  { mes: "Fev", valor: 132000 },
  { mes: "Mar", valor: 136500 },
  { mes: "Abr", valor: 138000 },
  { mes: "Mai", valor: 143800 },
  { mes: "Jun", valor: 147000 },
  { mes: "Jul", valor: 151590 },
];

const despesaPorCat = OF ? OF.despesaPorCat : [
  { nome: "Moradia", valor: 2690 },
  { nome: "Alimentação", valor: 1980 },
  { nome: "Transporte", valor: 1120 },
  { nome: "Impostos & Contab.", valor: 890 },
  { nome: "Saúde", valor: 760 },
  { nome: "Lazer", valor: 640 },
  { nome: "Educação", valor: 450 },
  { nome: "Pessoal", valor: 370 },
];

const catTree = OF ? OF.catTree : {
  receita: [
    { nome: "Trabalho", subs: ["Pró-labore PJ", "Freelance", "Consultoria"], total: 15800 },
    { nome: "Rendimentos", subs: ["Juros", "Dividendos"], total: 0 },
    { nome: "Reembolsos", subs: ["Despesas de cliente", "Outros"], total: 540 },
    { nome: "Vendas", subs: ["Itens usados"], total: 0 },
  ],
  despesa: [
    { nome: "Moradia", subs: ["Aluguel", "Condomínio", "Energia", "Internet"], total: 2690 },
    { nome: "Alimentação", subs: ["Supermercado", "Restaurante", "Delivery"], total: 1980 },
    { nome: "Transporte", subs: ["Combustível", "Aplicativos", "Manutenção", "Passagens"], total: 1120 },
    { nome: "Impostos & Contabilidade", subs: ["DAS Simples", "Contabilidade"], total: 890 },
    { nome: "Saúde", subs: ["Plano", "Farmácia", "Consultas"], total: 760 },
    { nome: "Lazer", subs: ["Streaming", "Bares", "Viagens"], total: 640 },
    { nome: "Educação", subs: ["Cursos", "Livros"], total: 450 },
    { nome: "Pessoal", subs: ["Assinaturas", "Roupas"], total: 370 },
  ],
};

const initialTx = OF ? OF.tx : [
  { id: 1, data: "15/07", desc: "Pró-labore", tipo: "receita", cat: "Trabalho", sub: "Pró-labore PJ", conta: "Conta Corrente", valor: 12000, status: "conciliado" },
  { id: 2, data: "14/07", desc: "iFood", tipo: "despesa", cat: "Alimentação", sub: "Delivery", conta: "Cartão de Crédito", valor: -68.9, status: "conciliado" },
  { id: 3, data: "13/07", desc: "Aporte investimentos", tipo: "transferencia", origem: "Conta Corrente", destino: "Investimentos", valor: 3000, status: "conciliado" },
  { id: 4, data: "12/07", desc: "Posto Shell", tipo: "despesa", cat: "Transporte", sub: "Combustível", conta: "Cartão de Crédito", valor: -220, status: "pendente" },
  { id: 5, data: "11/07", desc: "Reembolso viagem cliente", tipo: "reembolso", cat: "Transporte", sub: "Passagens", conta: "Conta Corrente", valor: 540, status: "conciliado" },
  { id: 6, data: "10/07", desc: "Aluguel", tipo: "despesa", cat: "Moradia", sub: "Aluguel", conta: "Conta Corrente", valor: -1800, status: "conciliado" },
  { id: 7, data: "09/07", desc: "DAS Simples Nacional", tipo: "despesa", cat: "Impostos & Contabilidade", sub: "DAS Simples", conta: "Conta Corrente", valor: -890, status: "conciliado" },
  { id: 8, data: "05/07", desc: "Freela edtech", tipo: "receita", cat: "Trabalho", sub: "Freelance", conta: "Conta Corrente", valor: 3800, status: "conciliado" },
  { id: 9, data: "03/07", desc: "Nordestão", tipo: "despesa", cat: "Alimentação", sub: "Supermercado", conta: "Cartão de Crédito", valor: -412, status: "conciliado" },
  { id: 10, data: "01/07", desc: "Compra do carro", tipo: "transferencia", origem: "Conta Corrente", destino: "Carro — Honda City", valor: 82000, status: "conciliado", nota: "Alocação de patrimônio" },
];

accounts.forEach((a, i) => { if (a.arquivada === undefined) a.arquivada = false; a.ordem = i; });
// movimentos de ativos (compra/venda) das contas de investimento — a posição/preço-médio é derivada
const assetMoves = [];
const netWorth = () => accounts.filter((a) => !a.arquivada).reduce((s, a) => s + acctTotal(a), 0);
const patrimonioLiquido = accounts.reduce((s, a) => s + a.saldo, 0);
const receitasMes = OF ? OF.receitasMes : 15800;
const despesasMes = OF ? OF.despesasMes : 8900;

/* ---------- investimentos: cotações (brapi) + posições derivadas dos movimentos ---------- */
// Preço da B3 direto do navegador: brapi.dev/api/quote/list responde com CORS liberado e sem token
// (1 request devolve {stock, close} de ~toda a B3 — ações, ETFs e FIIs). Cache em localStorage p/
// funcionar offline; nunca inventa preço (ticker ausente → posição fica sem cotação = usa o custo).
const QUOTES = {}; // { TICKER: preço }
let quotesTs = 0;  // epoch ms da última atualização bem-sucedida
function loadQuotesCache() {
  try { const j = JSON.parse(localStorage.getItem("mc_quotes") || "null"); if (j && j.map) { Object.assign(QUOTES, j.map); quotesTs = j.ts || 0; } } catch (e) {}
}
async function fetchQuotes() {
  try {
    const r = await fetch("https://brapi.dev/api/quote/list?limit=10000");
    if (!r.ok) return false;
    const j = await r.json();
    (j.stocks || []).forEach((s) => { if (s && s.stock && s.close != null) QUOTES[String(s.stock).toUpperCase()] = Math.round(s.close * 100) / 100; });
    quotesTs = Date.now();
    try { localStorage.setItem("mc_quotes", JSON.stringify({ ts: quotesTs, map: QUOTES })); } catch (e) {}
    return true;
  } catch (e) { return false; }
}
const assetPrice = (ticker) => { const p = QUOTES[String(ticker || "").toUpperCase()]; return typeof p === "number" && isFinite(p) ? p : null; };

// Histórico de cotação (fechamento mensal) via /api/history/{ticker} — Function serverless que faz
// proxy do Yahoo (o navegador não alcança direto: CORS/rate-limit). Mapa {TICKER: {ym: close}}.
const PRICE_HIST = {}; // { TICKER: { "2026-01": 60.1, ... } }
let histTs = 0;
function loadHistCache() {
  try { const j = JSON.parse(localStorage.getItem("mc_hist") || "null"); if (j && j.map) { Object.assign(PRICE_HIST, j.map); histTs = j.ts || 0; } } catch (e) {}
}
function saveHistCache() { try { localStorage.setItem("mc_hist", JSON.stringify({ ts: histTs, map: PRICE_HIST })); } catch (e) {} }
// busca a série mensal de cada ticker em carteira (só os que faltam ou estão velhos). Falha silenciosa
// por ticker — sem histórico, o cálculo cai no custo (nunca inventa preço).
async function fetchHistory(force) {
  const tickers = [...new Set(assetMoves.map((m) => String(m.ticker || "").toUpperCase()).filter(Boolean))];
  const stale = Date.now() - histTs > 6 * 3600 * 1000;
  const alvo = tickers.filter((t) => force || stale || !PRICE_HIST[t]);
  if (!alvo.length) return false;
  let ok = false;
  await Promise.all(alvo.map(async (t) => {
    try {
      const r = await fetch(`/api/history/${encodeURIComponent(t)}?range=3y&interval=1mo`);
      if (!r.ok) return;
      const j = await r.json();
      if (Array.isArray(j.series) && j.series.length) { const m = {}; j.series.forEach(([ym, close]) => { m[ym] = close; }); PRICE_HIST[t] = m; ok = true; }
    } catch (e) {}
  }));
  if (ok) { histTs = Date.now(); saveHistCache(); }
  return ok;
}
// cotação do ticker ao fim do mês `ym`: usa o fechamento daquele mês; se faltar, o mês anterior mais
// próximo disponível; senão a cotação atual; retorna null se não há nada (aí o chamador usa o custo).
function histPriceAt(ticker, ym) {
  const h = PRICE_HIST[String(ticker || "").toUpperCase()];
  if (h) {
    if (h[ym] != null) return h[ym];
    const keys = Object.keys(h).filter((k) => k <= ym).sort();
    if (keys.length) return h[keys[keys.length - 1]];
  }
  const now = assetPrice(ticker);
  return now != null ? now : null;
}
const CLASSE_LABEL = { acao: "Ação", etf: "ETF", fii: "FII", rf: "Renda fixa", caixa: "Caixa", outro: "Outro" };
const hasHoldings = () => assetMoves.length > 0;
const temAtivos = (a) => a && assetMoves.some((m) => m.contaId === a.id);

// Posição atual por ticker numa conta, derivada dos movimentos (custo médio ponderado).
// compra: soma qtd e custo. venda: reduz qtd pelo PM atual (custo médio), realiza ganho.
function computePositions(contaId) {
  const moves = assetMoves.filter((m) => m.contaId === contaId)
    .slice().sort((a, b) => String(a.iso || "").localeCompare(String(b.iso || "")));
  const pos = {};
  moves.forEach((m) => {
    const k = String(m.ticker || "?").toUpperCase();
    const o = pos[k] || (pos[k] = { ticker: k, nome: m.nome || "", classe: m.classe || "", qtd: 0, custo: 0, realizado: 0 });
    if (m.nome) o.nome = m.nome;
    if (m.classe) o.classe = m.classe;
    const q = numOr0(m.qtd), pr = numOr0(m.preco);
    if (m.tipo === "venda") {
      const pm = o.qtd > 0 ? o.custo / o.qtd : 0;
      const qv = Math.min(q, o.qtd); // não vende mais do que tem
      o.custo -= pm * qv; o.qtd -= qv; o.realizado += (pr - pm) * qv;
    } else {
      o.qtd += q; o.custo += pr * q;
    }
  });
  return Object.values(pos).map((o) => {
    const pm = o.qtd > 0 ? o.custo / o.qtd : 0;
    const price = assetPrice(o.ticker);
    const cot = price != null ? price : pm; // sem cotação → vale o custo (ganho 0)
    const valor = o.qtd * cot;
    const ganho = valor - o.custo;
    return Object.assign({}, o, { pm, cotacao: price, valor, ganho, ganhoPct: o.custo > 0 ? (ganho / o.custo) * 100 : 0, semCotacao: price == null });
  }).filter((o) => Math.abs(o.qtd) > 1e-9)
    .sort((a, b) => b.valor - a.valor);
}
// Conta de investimento = CAIXA + INVESTIDO (nada é sobrescrito; tudo derivado ao vivo):
//   investido  = Σ valor de mercado dos ativos (qtd × cotação)
//   cashDelta  = efeito das compras/vendas no caixa (compra sai −, venda entra +)
//   caixa      = saldo transacional (aportes/saques) + cashDelta  → dinheiro parado na corretora
//   total      = caixa + investido  → é o que vale a conta (entra no patrimônio)
// Para conta sem ativos, investido e cashDelta são 0 ⇒ total == saldo (comportamento normal).
function invInvestido(a) { return a ? computePositions(a.id).reduce((s, p) => s + p.valor, 0) : 0; }
function invCashDelta(a) {
  if (!a) return 0;
  return assetMoves.filter((m) => m.contaId === a.id)
    .reduce((s, m) => s + (m.tipo === "venda" ? 1 : -1) * numOr0(m.qtd) * numOr0(m.preco), 0);
}
const carteiraCaixa = (a) => numOr0(a && a.saldo) + invCashDelta(a);
function acctTotal(a) { return a ? Math.round((numOr0(a.saldo) + invCashDelta(a) + invInvestido(a)) * 100) / 100 : 0; }

/* helpers de conta / drill */
const acctById = (id) => accounts.find((a) => a.id === id);
const acctByName = (nome) => accounts.find((a) => a.nome === nome);
// aplica (sign=+1) ou reverte (sign=-1) o efeito de UM lançamento no saldo das contas afetadas.
// Chamado só em ações do app (criar/editar/excluir/conciliar) — o saldo é guardado, não recalculado.
function applyTxToBalance(tx, sign) {
  if (!tx) return;
  // conta de patrimônio: transferir dinheiro pra ela é ALOCAR — mexe no alocado também
  // (mantém a relação Valor atual = Valor alocado + Custos).
  const bump = (a, delta) => { if (!a) return; a.saldo += delta; if (a.tipo === "patrimonio" && a.alocado != null) a.alocado += delta; };
  if (tx.tipo === "transferencia") {
    const amt = Math.abs(tx.valor);
    bump(acctByName(tx.origem), -sign * amt);
    bump(acctByName(tx.destino), sign * amt);
  } else {
    const c = acctByName(tx.conta);
    if (c) c.saldo += sign * tx.valor; // tx.valor já assinado (despesa negativa, receita/reembolso positiva)
  }
}
const acctTx = (nome) => state.tx.filter((t) => t.conta === nome || t.origem === nome || t.destino === nome);
// valor do lançamento sob a ótica DESTA conta (transferência: saída se origem, entrada se destino)
function txValorConta(t, nome) {
  if (t.tipo === "transferencia") return t.destino === nome ? Math.abs(t.valor) : -Math.abs(t.valor);
  return t.valor;
}
// quebra de categorias de um mês/tipo (mock: distribui o total do mês pelas proporções conhecidas)
// categorias reais de um mês (ym "YYYY-MM") por tipo — receita pura / despesa líquida de reembolso
function drillCats(ym, tipo) { return byCat(tipo, ym); }
// resumo de TODOS os meses com dados (mais recente primeiro)
function allMonthsSummary() {
  return txMonths().slice().reverse().map((ym) => ({
    ym, label: monthLabel(ym + "-01"),
    receita: byCat("receita", ym).reduce((s, d) => s + d.valor, 0),
    despesa: byCat("despesa", ym).reduce((s, d) => s + d.valor, 0),
  }));
}

const TIPOS = {
  receita: { label: "Receita", cor: C.receita, icon: "trending-up" },
  despesa: { label: "Despesa", cor: C.despesa, icon: "trending-down" },
  transferencia: { label: "Transferência", cor: C.transfer, icon: "transfer" },
  reembolso: { label: "Reembolso", cor: C.reembolso, icon: "undo" },
};
const ACCT_ICON = { banco: "landmark", cartao: "credit-card", dinheiro: "banknote", invest: "invest", patrimonio: "car" };
const PAGE = {
  dashboard: ["Visão geral", "Como está seu dinheiro em Julho de 2026"],
  patrimonial: ["Visão patrimonial", "Cockpit · consolidado em BRL"],
  contas: ["Contas", "Saldos e alocações de patrimônio"],
  transacoes: ["Transações", "Receitas, despesas, transferências e reembolsos"],
  conciliacao: ["Conciliação", "Importe o extrato e confirme as sugestões"],
  categorias: ["Categorias", "Estrutura de receitas e despesas"],
  historico: ["Histórico", "Toda alteração registrada, por dia — como um diário de mudanças"],
  config: ["Configurações", "Sua conta, segurança e dados"],
};
const APP_VERSION = (() => { try { const s = [...document.scripts].find((x) => /app\.js/.test(x.src)); const m = s && s.src.match(/v=(\d+)/); return m ? m[1] : ""; } catch (e) { return ""; } })();

/* ---------- 3. helpers ---------- */
// nunca deixa um valor ausente/NaN derrubar a tela inteira (uma conta de patrimônio sem `alocado`
// gravado, por exemplo, estourava `viewContas` e a aba Contas ficava em branco).
// texto indo pra dentro de um atributo HTML (value="…"): sem escapar, uma descrição/nome com aspas
// truncava o input e injetava markup no meio do modal.
const attr = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const numOr0 = (n) => (typeof n === "number" && isFinite(n) ? n : (isFinite(parseFloat(n)) ? parseFloat(n) : 0));
const fmt = (n) => numOr0(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtShort = (n) => "R$ " + Math.abs(numOr0(n)).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const fmtNum = (n) => Math.abs(numOr0(n)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TODAY_ISO = new Date().toISOString().slice(0, 10); // data real de hoje (default de nova transação, chips Hoje/Ontem)
const parseValor = (s) => parseFloat(String(s || "").replace(/\./g, "").replace(",", ".")) || 0;
const dataBR = (iso) => { const [, m, d] = (iso || TODAY_ISO).split("-"); return `${d}/${m}`; };
const dataFullBR = (iso) => { const p = String(iso || "").split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ""; };
const isoPlusDays = (iso, n) => { const d = new Date((iso || TODAY_ISO) + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

const ICON = {
  "layout": '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  "trash": '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  "key": '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.5 12.5 8-8"/><path d="m16 4.5 3 3"/><path d="m13.5 7 2.5 2.5"/>',
  "settings": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  "download": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  "shield": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
  "log-out": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  "rotate": '<path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/>',
  "history": '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><polyline points="3 3 3 8 8 8"/><polyline points="12 7 12 12 15 14"/>',
  "wallet": '<path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2"/><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="13" r="1.1" fill="currentColor" stroke="none"/>',
  "transfer": '<polyline points="16 3 21 8 16 13"/><line x1="21" y1="8" x2="4" y2="8"/><polyline points="8 11 3 16 8 21"/><line x1="3" y1="16" x2="20" y2="16"/>',
  "checklist": '<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="m4 6 1 1 2-2"/><path d="m4 12 1 1 2-2"/><path d="m4 18 1 1 2-2"/>',
  "folder-tree": '<rect x="3" y="4" width="5" height="5" rx="1"/><path d="M11 6.5h9"/><path d="M11 12h9"/><path d="M11 17.5h9"/><path d="M7 8v10h4"/><path d="M7 13.5h4"/>',
  "plus": '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  "trending-up": '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>',
  "trending-down": '<polyline points="3 7 9 13 13 9 21 17"/><polyline points="15 17 21 17 21 11"/>',
  "undo": '<path d="M3 8a9 9 0 1 0 2.5-5.5"/><polyline points="3 2 3 8 9 8"/>',
  "building": '<path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M4 21h16"/><rect x="10" y="15" width="4" height="6"/><line x1="9" y1="8" x2="9.01" y2="8"/><line x1="15" y1="8" x2="15.01" y2="8"/><line x1="9" y1="11.5" x2="9.01" y2="11.5"/><line x1="15" y1="11.5" x2="15.01" y2="11.5"/>',
  "credit-card": '<rect x="3" y="5" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="7" y1="15" x2="11" y2="15"/>',
  "landmark": '<line x1="3" y1="21" x2="21" y2="21"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="5 6 12 3 19 6"/><line x1="5" y1="10" x2="5" y2="21"/><line x1="9.5" y1="10" x2="9.5" y2="21"/><line x1="14.5" y1="10" x2="14.5" y2="21"/><line x1="19" y1="10" x2="19" y2="21"/>',
  "car": '<path d="M5 13l1.6-4.7A2 2 0 0 1 8.5 7h7a2 2 0 0 1 1.9 1.3L19 13"/><path d="M4 13h16v4a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><circle cx="7.5" cy="15.5" r="1"/><circle cx="16.5" cy="15.5" r="1"/>',
  "invest": '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  "banknote": '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.4"/><line x1="6" y1="12" x2="6.5" y2="12"/><line x1="17.5" y1="12" x2="18" y2="12"/>',
  "check": '<polyline points="20 6 9 17 4 12"/>',
  "pencil": '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  "x": '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  "upload": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 9 12 4 17 9"/><line x1="12" y1="4" x2="12" y2="16"/>',
  "sparkles": '<path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7z"/><path d="M18.5 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  "chevron-down": '<polyline points="6 9 12 15 18 9"/>',
  "arrow-right": '<line x1="4" y1="12" x2="18" y2="12"/><polyline points="13 7 18 12 13 17"/>',
  "circle-alert": '<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="16.3" r="0.6" fill="currentColor" stroke="none"/>',
  "coins": '<circle cx="9" cy="9" r="6"/><path d="M15.5 5.2a6 6 0 1 1 0 13.6"/>',
  "home": '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  "utensils": '<path d="M5 3v8a3 3 0 0 0 6 0V3M8 3v18"/><path d="M17 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4v9"/>',
  "receipt": '<path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z"/><path d="M9 8h6M9 12h6"/>',
  "heart": '<path d="M20.8 6.6a5 5 0 0 0-7.1 0L12 8.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21l8.8-8.8a5 5 0 0 0 0-7.1z"/>',
  "play-circle": '<circle cx="12" cy="12" r="9"/><path d="M10 9l5 3-5 3z"/>',
  "book": '<path d="M3 8l9-4 9 4-9 4z"/><path d="M7 10v5c0 1.5 5 3 5 3s5-1.5 5-3v-5"/>',
  "user": '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  "briefcase": '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  "tag": '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  "chevron-up": '<polyline points="18 15 12 9 6 15"/>',
  "sliders": '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  "grip": '<circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>',
  "more-vertical": '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
  "archive": '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><line x1="10" y1="12" x2="14" y2="12"/>',
  "arrow-left": '<line x1="20" y1="12" x2="5" y2="12"/><polyline points="11 6 5 12 11 18"/>',
  "list": '<line x1="8" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="8" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  "cart": '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.3 11.4a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 7H6"/>',
  "coffee": '<path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 9h2a2 2 0 0 1 0 4h-2"/><path d="M7 3v2M11 3v2"/>',
  "fuel": '<rect x="4" y="4" width="9" height="16" rx="1"/><path d="M4 11h9"/><path d="M13 8l3 2v6a2 2 0 0 0 4 0V9l-3-3"/>',
  "map-pin": '<path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  "dumbbell": '<path d="M6.5 6.5v11M3.5 8.5v7M17.5 6.5v11M20.5 8.5v7M6.5 12h11"/>',
  "gift": '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8"/><path d="M12 8v13"/><path d="M12 8S9.5 8 8.5 6.5A1.8 1.8 0 0 1 12 5.5 1.8 1.8 0 0 1 15.5 6.5C14.5 8 12 8 12 8z"/>',
  "paw": '<circle cx="7" cy="9" r="1.5"/><circle cx="12" cy="7" r="1.5"/><circle cx="17" cy="9" r="1.5"/><path d="M12 12c-2.8 0-5 1.9-5 3.8A2.2 2.2 0 0 0 9.2 18h5.6a2.2 2.2 0 0 0 2.2-2.2C17 13.9 14.8 12 12 12z"/>',
  "phone": '<rect x="7" y="2" width="10" height="20" rx="2.5"/><line x1="11" y1="18" x2="13" y2="18"/>',
  "shirt": '<path d="M8 3 4 6l2 3 2-1v10h8V8l2 1 2-3-4-3-3 2a2 2 0 0 1-4 0z"/>',
  "smile": '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.3 1.8 3.5 1.8 3.5-1.8 3.5-1.8"/><line x1="9" y1="9.5" x2="9.01" y2="9.5"/><line x1="15" y1="9.5" x2="15.01" y2="9.5"/>',
  "calendar": '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><line x1="3" y1="9.5" x2="21" y2="9.5"/><line x1="8" y1="2.5" x2="8" y2="6.5"/><line x1="16" y1="2.5" x2="16" y2="6.5"/>',
};

/* nome da categoria → ícone (default por reconhecimento) */
const CAT_ICON = {
  // categorias reais do Orçamento Fácil
  "LAZER": "smile", "Compras": "cart", "Casa": "home", "Custo de Vida": "receipt", "Investimento": "invest",
  "Trabalho": "briefcase", "Rendimentos financeiros": "trending-up", "Outro (Receitas)": "coins",
  "Outros": "tag",
  // nomes do mock / genéricos (compatibilidade)
  "Moradia": "home", "Alimentação": "utensils", "Transporte": "car", "Impostos & Contabilidade": "receipt",
  "Saúde": "heart", "Lazer": "smile", "Educação": "book", "Pessoal": "user",
  "Rendimentos": "coins", "Reembolsos": "undo", "Vendas": "tag",
};
const catIcon = (nome) => CAT_ICON[nome] || "tag";
// ícones disponíveis para escolher (categorias e contas) — todos existem no ICON
const ICON_CHOICES = ["home", "cart", "utensils", "coffee", "car", "fuel", "map-pin", "heart", "dumbbell", "play-circle", "smile", "book", "gift", "user", "paw", "phone", "shirt", "briefcase", "receipt", "credit-card", "landmark", "banknote", "invest", "coins", "trending-up", "tag", "building", "wallet"];
const catIconOf = (node) => (node && node.icon) || catIcon(node ? node.nome : "");
const acctIconOf = (a) => (a && a.icon) || (a && a.grupo === "pat" ? "car" : ACCT_ICON[a && a.tipo]) || "wallet";
function iconPicker(attr, selected) {
  return `<div class="icon-grid">${ICON_CHOICES.map((k) => `<button class="icon-pick${selected === k ? " on" : ""}" ${attr}="${k}" type="button">${ic(k, 18)}</button>`).join("")}</div>`;
}
function ic(name, size = 16) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[name] || ""}</svg>`;
}

/* ---------- 4. componentes ---------- */
function badgeHTML(tipo, small) {
  const t = TIPOS[tipo];
  return `<span class="badge" style="color:${t.cor};background:${t.cor}1A;font-size:${small ? 11 : 12}px">${ic(t.icon, small ? 11 : 13)} ${t.label}</span>`;
}
function moneyHTML(tipo, valor, big) {
  const positivo = tipo === "receita" || tipo === "reembolso";
  const neutro = tipo === "transferencia";
  const cor = neutro ? "var(--sub)" : positivo ? "var(--pos)" : "var(--neg)";
  const sinal = neutro ? "" : positivo ? "+" : "−";
  return `<span class="num" style="color:${cor};font-weight:600;font-size:${big ? 15 : 14}px">${sinal} ${fmt(Math.abs(valor))}</span>`;
}
function kpi(label, valor, delta, good, iconName, cor) {
  return `<div class="card kpi"><div class="kpi-top"><span class="kpi-label">${label}</span><span class="kpi-ic" style="background:${cor}1A;color:${cor}">${ic(iconName, 16)}</span></div><div class="kpi-val num">${fmt(valor)}</div>${delta ? `<div class="kpi-delta" style="color:${good ? C.receita : C.despesa}">${delta}</div>` : ""}</div>`;
}

/* ---------- 5. gráficos SVG ---------- */
function barChartSVG(data) {
  const W = 520, H = 240, padL = 44, padR = 12, padT = 14, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = Math.max(1, ...data.flatMap((d) => [d.receita, d.despesa]));
  const gridMax = Math.max(4000, Math.ceil(max / 4000) * 4000);
  const n = data.length || 1;
  // barras e rótulos se adaptam à quantidade de meses (cabe de 3 a 30+ meses sem sobrepor)
  const slot = plotW / n, gap = Math.min(4, slot * 0.12);
  const bw = Math.max(2, Math.min(14, slot / 2 - gap));
  const rx = Math.min(3, bw / 2), lblStep = Math.max(1, Math.ceil(n / 8));
  let g = "";
  for (let i = 0; i <= 4; i++) {
    const val = (gridMax * i) / 4, y = padT + plotH - (val / gridMax) * plotH;
    g += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--hair)"/>`;
    g += `<text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--subtle)">${fmtShort(val)}</text>`;
  }
  data.forEach((d, i) => {
    const cx = padL + (i + 0.5) * slot;
    [["receita", C.receita, -1, "Receitas"], ["despesa", C.despesa, 1, "Despesas"]].forEach(([k, col, side, lbl]) => {
      const h = (d[k] / gridMax) * plotH, x = side < 0 ? cx - bw - gap / 2 : cx + gap / 2, y = padT + plotH - h;
      g += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="${rx}" fill="${col}"><title>${lbl} · ${d.mes}: ${fmt(d[k])}</title></rect>`;
    });
    if (i % lblStep === 0 || i === n - 1) g += `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--subtle)">${d.mes}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" font-family="Inter,sans-serif">${g}</svg>`;
}

function donutSVG(data, colors) {
  const cx = 100, cy = 100, r = 68, sw = 26, circ = 2 * Math.PI * r;
  const pal = colors || donutPalette;
  const total = data.reduce((s, d) => s + d.valor, 0) || 1;
  let off = 0, segs = "";
  data.forEach((d, i) => {
    const len = (d.valor / total) * circ, dash = Math.max(len - 2, 0.5);
    segs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${pal[i % pal.length]}" stroke-width="${sw}" stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${-off}"><title>${d.nome}: ${fmt(d.valor)}</title></circle>`;
    off += len;
  });
  return `<svg viewBox="0 0 200 200" width="100%" height="100%"><g transform="rotate(-90 100 100)">${segs}</g></svg>`;
}

function areaChartSVG(s) {
  const W = 520, H = 200, padL = 44, padR = 12, padT = 12, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const vals = s.map((d) => d.valor), dMin = Math.min(...vals), dMax = Math.max(...vals);
  const pad = (dMax - dMin) * 0.3 || dMax * 0.1, yMin = dMin - pad, yMax = dMax + pad, n = s.length;
  const X = (i) => padL + i * (plotW / (n - 1));
  const Y = (v) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  let grid = "";
  for (let i = 0; i <= 3; i++) {
    const val = yMin + ((yMax - yMin) * i) / 3, y = Y(val);
    grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--hair)"/><text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--subtle)">${fmtShort(val)}</text>`;
  }
  const pts = s.map((d, i) => [X(i), Y(d.valor)]);
  const line = "M" + pts.map((p) => `${p[0]} ${p[1]}`).join(" L ");
  const area = line + ` L ${X(n - 1)} ${padT + plotH} L ${X(0)} ${padT + plotH} Z`;
  const dots = s.map((d, i) => `<circle cx="${X(i)}" cy="${Y(d.valor)}" r="3.2" fill="${C.brand}"><title>${d.mes}: ${fmt(d.valor)}</title></circle>`).join("");
  const xl = s.map((d, i) => `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--subtle)">${d.mes}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" font-family="Inter,sans-serif"><defs><linearGradient id="gp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${C.brand}" stop-opacity="0.28"/><stop offset="100%" stop-color="${C.brand}" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#gp)"/><path d="${line}" fill="none" stroke="${C.brand}" stroke-width="2.5"/>${dots}${xl}</svg>`;
}

/* ---------- 6. views ---------- */
/* blocos reordenáveis do dashboard */
// série mês a mês de receitas e despesas, das transações reais (reembolso abate a despesa)
function receitaDespesaSeries() {
  const months = txMonths();
  if (!months.length) return []; // sem lançamentos → gráfico vazio (nada de dados de exemplo)
  const rec = {}, desp = {};
  state.tx.forEach((t) => {
    const k = (t.iso || "").slice(0, 7); if (!k) return;
    if (t.tipo === "receita") rec[k] = (rec[k] || 0) + Math.abs(t.valor);
    else if (t.tipo === "despesa") desp[k] = (desp[k] || 0) + Math.abs(t.valor);
    else if (t.tipo === "reembolso") desp[k] = (desp[k] || 0) - Math.abs(t.valor);
  });
  return months.map((ym) => ({ ym, mes: mesAbbrev(ym), receita: Math.max(rec[ym] || 0, 0), despesa: Math.max(desp[ym] || 0, 0) }));
}
function blkReceitaDespesa() {
  const full = receitaDespesaSeries(), N = full.length;
  if (!N) return `<div class="card"><div class="card-head"><h3>Receitas × Despesas</h3></div><div class="empty-mini">Sem lançamentos ainda — adicione uma transação para ver o gráfico.</div></div>`;
  const opts = [6, 12, 24].filter((x) => x < N);
  const valid = [...opts.map(String), "all"];
  const range = valid.includes(state.rdRange) ? state.rdRange : (N > 12 ? "12" : "all");
  const nShow = range === "all" ? N : Math.min(+range, N);
  const s = full.slice(-nShow), n = s.length;
  const chips = [...opts.map((x) => ({ k: String(x), lb: x + "M" })), { k: "all", lb: "Tudo" }].map((r) => `<button class="pc-range${range === r.k ? " on" : ""}" data-rdrange="${r.k}">${r.lb}</button>`).join("");
  return `<div class="card">
    <div class="card-head">
      <div><h3>Receitas × Despesas</h3><span class="card-sub">${n} ${n === 1 ? "mês" : "meses"}</span></div>
      <button class="card-sub drill-hint" data-drill="open">detalhar ${ic("arrow-right", 12)}</button>
    </div>
    ${opts.length ? `<div class="pc-ranges"><div class="pc-chips">${chips}</div></div>` : ""}
    <div class="chart" style="height:260px">${barChartSVG(s)}</div>
    <div class="legend"><span><i style="background:${C.receita}"></i> Receitas</span><span><i style="background:${C.despesa}"></i> Despesas</span></div>
  </div>`;
}
/* meses e despesas por categoria a partir das transações reais */
function txMonths() {
  const set = new Set();
  state.tx.forEach((t) => { const k = (t.iso || "").slice(0, 7); if (k) set.add(k); });
  return [...set].sort();
}
function byCat(tipo, ym) {
  const map = {};
  state.tx.forEach((t) => {
    if ((t.iso || "").slice(0, 7) !== ym) return;
    if (tipo === "despesa") {
      if (t.tipo === "despesa") map[t.cat] = (map[t.cat] || 0) + Math.abs(t.valor);
      else if (t.tipo === "reembolso") map[t.cat] = (map[t.cat] || 0) - Math.abs(t.valor); // reembolso reduz a despesa
    } else if (t.tipo === tipo) {
      map[t.cat] = (map[t.cat] || 0) + Math.abs(t.valor);
    }
  });
  return Object.entries(map).filter(([, v]) => v > 0.005).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
}
// total real (todo o histórico) por categoria — receita soma; despesa soma e abate reembolso
function catTotals(tipo) {
  const m = {};
  state.tx.forEach((t) => {
    const nome = t.cat; if (!nome) return;
    if (tipo === "despesa") {
      if (t.tipo === "despesa") m[nome] = (m[nome] || 0) + Math.abs(t.valor);
      else if (t.tipo === "reembolso") m[nome] = (m[nome] || 0) - Math.abs(t.valor);
    } else if (t.tipo === tipo) m[nome] = (m[nome] || 0) + Math.abs(t.valor);
  });
  Object.keys(m).forEach((k) => { if (m[k] < 0) m[k] = 0; });
  return m;
}
// mês inicial do donut/ganhos = mês atual (consistente com o Extrato). O usuário navega com as setas.
function defaultMonth(tipo) { return (OF && OF.refMonthYM) || TODAY_ISO.slice(0, 7); }
const ymLabel = (ym) => monthLabel(ym + "-01");
const catColor = (i) => donutPalette[i % donutPalette.length];
const MES3 = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const mesAbbrev = (ym) => (ym ? `${MES3[+ym.slice(5, 7) - 1]}/${ym.slice(2, 4)}` : "");
// série de patrimônio líquido mês a mês, reconstruída dos fluxos (receita−despesa) a partir do saldo atual
function netWorthSeries() {
  const months = txMonths();
  if (!months.length) return []; // sem histórico real → vazio (o bloco mostra "Sem histórico")
  const flow = {};
  state.tx.forEach((t) => { if (t.tipo === "transferencia") return; const k = (t.iso || "").slice(0, 7); if (!k) return; flow[k] = (flow[k] || 0) + (t.tipo === "despesa" ? -Math.abs(t.valor) : Math.abs(t.valor)); });
  const val = new Array(months.length);
  val[months.length - 1] = netWorth();
  for (let i = months.length - 2; i >= 0; i--) val[i] = val[i + 1] - (flow[months[i + 1]] || 0);
  return months.map((ym, i) => ({ ym, mes: mesAbbrev(ym), valor: Math.round(val[i] * 100) / 100 }));
}
function pcIdxAt(pc, clientX) {
  const r = pc.getBoundingClientRect(), n = pc.querySelectorAll(".pc-dot").length;
  if (!r.width || !n) return 0;
  const f = (clientX - r.left) / r.width;
  return isFinite(f) ? Math.round(Math.min(1, Math.max(0, f)) * (n - 1)) : 0;
}
function pcDrawBand(pc, a, b) {
  const dots = pc.querySelectorAll(".pc-dot"), n = dots.length; if (!n) return;
  a = Math.max(0, Math.min(n - 1, a)); b = Math.max(0, Math.min(n - 1, b));
  const lo = Math.min(a, b), hi = Math.max(a, b);
  const xa = parseFloat(dots[lo].dataset.x), xb = parseFloat(dots[hi].dataset.x);
  const band = pc.querySelector(".pc-band");
  if (band) { band.hidden = false; band.style.left = xa + "%"; band.style.width = (xb - xa) + "%"; }
  const va = parseFloat(dots[lo].dataset.val), vb = parseFloat(dots[hi].dataset.val);
  const dR = vb - va, pct = va ? (dR / va) * 100 : 0;
  const tip = pc.querySelector(".pc-tip");
  if (tip) {
    tip.hidden = false; tip.style.left = ((xa + xb) / 2) + "%"; tip.style.top = "6%";
    tip.innerHTML = `<b>${dots[lo].dataset.mes} → ${dots[hi].dataset.mes}</b><span class="num pc-d ${dR >= 0 ? "up" : "down"}">${dR >= 0 ? "+" : "−"} ${fmtNum(dR)}</span><span class="num pc-d ${dR >= 0 ? "up" : "down"}">${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%</span>`;
  }
  dots.forEach((d, i) => d.classList.toggle("sel", i === lo || i === hi));
}

function catDonut(tipo, data, activeCat) {
  const cx = 100, cy = 100, r = 66, sw = 26, circ = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.valor, 0) || 1;
  let off = 0, segs = "";
  data.forEach((d, i) => {
    const len = (d.valor / total) * circ, dash = Math.max(len - 1.5, 0.4), on = activeCat === d.nome;
    segs += `<circle class="cat-slice${on ? " on" : ""}" data-donut-slice="${tipo}|${d.nome}" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${catColor(i)}" stroke-width="${on ? sw + 7 : sw}" stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${-off}"><title>${d.nome}: ${fmt(d.valor)}</title></circle>`;
    off += len;
  });
  return `<svg viewBox="0 0 200 200" width="100%" height="100%"><g transform="rotate(-90 100 100)">${segs}</g></svg>`;
}
function bySub(tipo, cat, ym) {
  const map = {};
  state.tx.forEach((t) => {
    if (t.cat !== cat || (t.iso || "").slice(0, 7) !== ym) return;
    const k = t.sub || "Sem subcategoria";
    if (tipo === "despesa") {
      if (t.tipo === "despesa") map[k] = (map[k] || 0) + Math.abs(t.valor);
      else if (t.tipo === "reembolso") map[k] = (map[k] || 0) - Math.abs(t.valor);
    } else if (t.tipo === tipo) {
      map[k] = (map[k] || 0) + Math.abs(t.valor);
    }
  });
  return Object.entries(map).filter(([, v]) => v > 0.005).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
}
function catDonutBlock(tipo) {
  const st = state.donut[tipo];
  if (!st.month) st.month = defaultMonth(tipo);
  const ym = st.month, months = monthsAxis(), idx = months.indexOf(ym), drill = st.drill;
  const data = drill ? bySub(tipo, drill, ym) : (ym ? byCat(tipo, ym) : []);
  const total = data.reduce((s, d) => s + d.valor, 0);
  const active = st.active && data.some((d) => d.nome === st.active) ? st.active : null;
  const ao = active ? data.find((d) => d.nome === active) : null;
  const totColor = tipo === "despesa" ? "var(--neg)" : "var(--pos)";
  const titleTxt = tipo === "despesa" ? "Despesas por categoria" : "Ganhos por categoria";
  const semTxt = tipo === "despesa" ? "despesas" : "ganhos";
  const center = ao
    ? `<div class="donut-center"><span class="dc-nm">${active}</span><strong class="num">${fmtShort(ao.valor)}</strong><span class="dc-pct">${(ao.valor / total * 100).toFixed(1)}%</span></div>`
    : `<div class="donut-center"><span>total</span><strong class="num">${fmtShort(total)}</strong></div>`;
  const legend = data.map((d, i) => `<li class="cat-leg${active === d.nome ? " on" : ""}" data-donut-slice="${tipo}|${d.nome}"><i style="background:${catColor(i)}"></i><span>${d.nome}</span><b class="lg-pct">${(d.valor / total * 100).toFixed(0)}%</b><b class="num lg-val">${fmtShort(d.valor)}</b></li>`).join("");
  const head = drill
    ? `<div class="cd-head-l"><button class="cd-back" data-donut-back="${tipo}" aria-label="Voltar">${ic("arrow-left", 16)}</button><div><h3>${drill}</h3><span class="card-sub">subcategorias</span></div></div>`
    : `<h3>${titleTxt}</h3>`;
  let actions;
  if (active) {
    actions = drill
      ? `<button class="cd-see" data-donut-tx="${tipo}|${drill}|${active}">${ic("list", 13)} Ver lançamentos</button>`
      : `<div class="cd-actions"><button class="cd-see" data-donut-tx="${tipo}|${active}">${ic("list", 13)} Ver lançamentos</button><button class="cd-see alt" data-donut-drill="${tipo}|${active}">Ver subcategorias ${ic("arrow-right", 13)}</button></div>`;
  } else actions = `<span class="cd-hint">Toque numa fatia pra ${drill ? "ver os lançamentos" : "detalhar"}</span>`;
  return `<div class="card cat-donut-card">
    <div class="card-head">${head}
      <div class="cd-nav"><button class="cd-arrow" data-donut-month="${tipo}|prev" ${idx <= 0 ? "disabled" : ""} aria-label="Mês anterior">${ic("arrow-left", 15)}</button><span class="cd-month">${ym ? ymLabel(ym) : "—"}</span><button class="cd-arrow" data-donut-month="${tipo}|next" ${idx >= months.length - 1 ? "disabled" : ""} aria-label="Próximo mês">${ic("arrow-right", 15)}</button></div>
    </div>
    ${data.length ? `<div class="donut-wrap"><div class="donut-box">${catDonut(tipo, data, active)}${center}</div><ul class="cat-legend cd-legend">${legend}</ul></div>
    <div class="cd-foot"><span class="cd-total">Total <b class="num" style="color:${totColor}">${fmt(total)}</b></span>${actions}</div>`
      : `<div class="empty-mini">Sem ${semTxt} ${drill ? `em ${drill}` : "neste mês"}.</div>`}
  </div>`;
}
function blkPatrimonio() {
  const full = netWorthSeries(), N = full.length;
  if (!N) return `<div class="card"><div class="card-head"><h3>Evolução do patrimônio</h3></div><div class="empty-mini">Sem histórico.</div></div>`;
  const opts = [6, 12, 24].filter((x) => x < N);
  const valid = [...opts.map(String), "all"];
  const range = valid.includes(state.pcRange) ? state.pcRange : (N > 12 ? "12" : "all");
  const nShow = range === "all" ? N : Math.min(+range, N);
  const s = full.slice(-nShow), n = s.length;
  const vals = s.map((d) => d.valor), dMin = Math.min(...vals), dMax = Math.max(...vals);
  const pad = (dMax - dMin) * 0.35 || Math.abs(dMax) * 0.1 || 1, yMin = dMin - pad, yMax = dMax + pad;
  const xP = (i) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const yP = (v) => 100 - ((v - yMin) / (yMax - yMin)) * 100;
  const line = "M" + s.map((d, i) => `${xP(i).toFixed(2)} ${yP(d.valor).toFixed(2)}`).join(" L ");
  const area = `${line} L 100 100 L 0 100 Z`;
  const grid = [0, 33, 66, 100].map((g) => `<line x1="0" y1="${g}" x2="100" y2="${g}" stroke="var(--hair)" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join("");
  const dots = s.map((d, i) => `<button class="pc-dot" data-pt="${i}" data-mes="${d.mes}" data-val="${d.valor}" data-delta="${i > 0 ? (d.valor - s[i - 1].valor).toFixed(2) : 0}" data-x="${xP(i).toFixed(2)}" style="left:${xP(i)}%;top:${yP(d.valor)}%" aria-label="${d.mes}: ${fmt(d.valor)}"></button>`).join("");
  const step = Math.max(1, Math.ceil(n / 7));
  const xls = s.map((d, i) => (i % step === 0 || i === n - 1) ? `<span class="pc-xl" style="left:${xP(i)}%">${d.mes}</span>` : "").join("");
  const first = s[0].valor, last = s[n - 1].valor, delta = last - first, pct = first ? (delta / first) * 100 : 0;
  const sel = state.pcSel && state.pcSel.a < n && state.pcSel.b < n && state.pcSel.a !== state.pcSel.b ? state.pcSel : null;
  let band = `<div class="pc-band" hidden></div>`, selbar = "";
  if (sel) {
    const a = Math.min(sel.a, sel.b), b = Math.max(sel.a, sel.b), xa = xP(a), xb = xP(b);
    band = `<div class="pc-band" style="left:${xa}%;width:${xb - xa}%"></div>`;
    const dR = s[b].valor - s[a].valor, p2 = s[a].valor ? (dR / s[a].valor) * 100 : 0;
    selbar = `<div class="pc-selbar"><span class="ps-range">${s[a].mes} → ${s[b].mes}</span><span class="ps-delta num ${dR >= 0 ? "up" : "down"}">${dR >= 0 ? "▲ +" : "▼ −"}${fmtNum(dR)} · ${p2 >= 0 ? "+" : ""}${p2.toFixed(1)}%</span><button class="ps-clear" data-pcsel-clear aria-label="Limpar seleção">${ic("x", 14)}</button></div>`;
  }
  const chips = [...opts.map((x) => ({ k: String(x), lb: x + "M" })), { k: "all", lb: "Tudo" }].map((r) => `<button class="pc-range${range === r.k ? " on" : ""}" data-pcrange="${r.k}">${r.lb}</button>`).join("");
  return `<div class="card">
    <div class="card-head">
      <div><h3>Evolução do patrimônio</h3><span class="card-sub">líquido · ${n} ${n === 1 ? "mês" : "meses"}</span></div>
      <div class="pc-summary"><span class="pc-cur num">${fmtShort(last)}</span><span class="pc-delta num ${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "▲" : "▼"} ${fmtShort(delta)} · ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%</span></div>
    </div>
    <div class="pc-ranges"><div class="pc-chips">${chips}</div><span class="pc-draghint">arraste no gráfico pra medir um período</span></div>
    <div class="pchart">
      <svg class="pc-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="pcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--brand)" stop-opacity="0.20"/><stop offset="100%" stop-color="var(--brand)" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#pcg)"/><path d="${line}" fill="none" stroke="var(--brand)" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>
      ${band}
      <div class="pc-guide" hidden></div>
      ${dots}
      <div class="pc-tip" hidden></div>
    </div>
    <div class="pc-xls">${xls}</div>
    ${selbar}
  </div>`;
}
function blkUltimas() {
  return `<div class="card"><div class="card-head"><h3>Últimas transações</h3><button class="link" data-tab="transacoes">ver todas ${ic("arrow-right", 13)}</button></div><div class="mini-list">${state.tx.slice(0, 5).map((t) => `<div class="mini-row click" data-tx-open="${t.id}"><div class="mini-l">${badgeHTML(t.tipo, true)}<div><div class="mini-desc">${t.desc}</div><div class="mini-meta">${t.tipo === "transferencia" ? `${t.origem} → ${t.destino}` : `${t.cat}${t.sub ? " · " + t.sub : ""}`}</div></div></div>${moneyHTML(t.tipo, t.valor)}</div>`).join("")}</div></div>`;
}
const DASH_BLOCKS = {
  receitaDespesa: { title: "Receitas × Despesas", sub: "gráfico de barras", icon: "trending-up", cor: C.brand, render: blkReceitaDespesa },
  categorias: { title: "Despesas por categoria", sub: "rosca", icon: "trending-down", cor: C.despesa, render: () => catDonutBlock("despesa") },
  ganhos: { title: "Ganhos por categoria", sub: "rosca", icon: "trending-up", cor: C.receita, render: () => catDonutBlock("receita") },
  patrimonio: { title: "Evolução do patrimônio", sub: "área", icon: "building", cor: C.patrimonio, render: blkPatrimonio },
  ultimas: { title: "Últimas transações", sub: "lista", icon: "list", cor: C.transfer, render: blkUltimas },
};

function dashEditor() {
  const last = state.dashOrder.length - 1;
  const rows = state.dashOrder.map((key, idx) => {
    const b = DASH_BLOCKS[key];
    return `<div class="dash-edit-row${state.dragKey === key ? " dragging" : ""}" draggable="true" data-dash-row="${key}">
      <span class="der-grip" title="Arraste para reordenar">${ic("grip", 17)}</span>
      <span class="der-ic" style="background:${b.cor}1A;color:${b.cor}">${ic(b.icon, 17)}</span>
      <span class="der-txt"><b>${b.title}</b><span>${b.sub}</span></span>
      <span class="der-pos">${idx + 1}º</span>
      <span class="der-moves">
        <button class="dash-move" data-dash-move="${key}:up" title="Subir" ${idx === 0 ? "disabled" : ""}>${ic("chevron-up", 15)}</button>
        <button class="dash-move" data-dash-move="${key}:down" title="Descer" ${idx === last ? "disabled" : ""}>${ic("chevron-down", 15)}</button>
      </span>
    </div>`;
  }).join("");
  return `<div class="dash-editor">${rows}</div>`;
}

// totais de receita/despesa de um mês (ym "YYYY-MM"), somados das transações reais.
// transferência não conta; reembolso abate a despesa (mesma convenção do byCat).
function monthTotals(ym) {
  let rec = 0, desp = 0;
  if (ym) state.tx.forEach((t) => {
    if ((t.iso || "").slice(0, 7) !== ym) return;
    if (t.tipo === "receita") rec += Math.abs(t.valor);
    else if (t.tipo === "despesa") desp += Math.abs(t.valor);
    else if (t.tipo === "reembolso") desp -= Math.abs(t.valor);
  });
  return { rec, desp: Math.max(desp, 0) };
}
// mês de referência do Extrato: o do resumo (OF) se houver, senão o último mês com receita/despesa
// (ignora meses só com transferência — alinhado ao "Despesas por categoria" via defaultMonth)
// mês de referência do dashboard = MÊS ATUAL (calendário). Se estiver vazio, os cards mostram zero —
// é o comportamento esperado (não mostrar "junho" em julho).
function refMonthYM() { return (OF && OF.refMonthYM) || TODAY_ISO.slice(0, 7); }
// eixo de meses p/ navegação: os meses com lançamento + o mês atual (mesmo sem lançamento)
function monthsAxis() { const s = new Set(txMonths()); s.add(TODAY_ISO.slice(0, 7)); return [...s].sort(); }
function statementBand() {
  const ym = refMonthYM();
  const t = ym ? monthTotals(ym) : { rec: 0, desp: 0 }; // sem lançamentos → zero (não mock)
  const rec = t.rec, desp = t.desp, res = rec - desp;
  const cap = ym ? monthLabel(ym) : (REF_LABEL.charAt(0).toUpperCase() + REF_LABEL.slice(1));
  return `<div class="statement">
    <div class="stmt-top"><span class="stmt-eyebrow">Extrato</span><span class="stmt-period">${cap}</span></div>
    <div class="stmt-main">
      <div class="stmt-net"><span class="stmt-lbl">Patrimônio líquido</span><span class="stmt-big num">${fmt(netWorth())}</span></div>
      <div class="stmt-ledger">
        <div class="stmt-row"><span class="sl-k">Receitas do mês</span><span class="sl-op">+</span><span class="sl-v num" style="color:var(--pos)">${fmtNum(rec)}</span></div>
        <div class="stmt-row"><span class="sl-k">Despesas do mês</span><span class="sl-op">−</span><span class="sl-v num" style="color:var(--neg)">${fmtNum(desp)}</span></div>
        <div class="stmt-row total"><span class="sl-k">Resultado</span><span class="sl-op">=</span><span class="sl-v num" style="color:${res >= 0 ? "var(--pos)" : "var(--neg)"}">${res < 0 ? "−" : ""}${fmtNum(res)}</span></div>
      </div>
    </div>
  </div>`;
}

/* ================= Visão patrimonial (cockpit) ================= */
const PAT_CLASSES = [
  { key: "acao", label: "Ações", cor: "#3E7CB1" },
  { key: "etf", label: "ETFs", cor: "#5E9E7E" },
  { key: "fii", label: "FIIs", cor: "#B0863A" },
  { key: "rf", label: "Renda Fixa", cor: "#8A7A5C" },
  { key: "caixa", label: "Caixa", cor: "#7C89A0" },
  { key: "imovel", label: "Imóveis/Bens", cor: "#A65B4E" },
  { key: "outro", label: "Outros", cor: "#9A9B8C" },
];
const patMetas = () => (state.prefs && state.prefs.patMetas) || {};
const patSnaps = () => ((state.prefs && state.prefs.patSnaps) || []).slice().sort((a, b) => String(a.ym).localeCompare(String(b.ym)));
const patPrem = () => (state.prefs && state.prefs.patPremissas) || {};
// alocação por classe + bruto/passivos/líquido, tudo dos dados reais das contas/ativos
function patAlloc() {
  const val = { acao: 0, etf: 0, fii: 0, rf: 0, caixa: 0, imovel: 0, outro: 0 };
  let passivos = 0;
  accounts.filter((a) => !a.arquivada).forEach((a) => {
    const t = acctTotal(a);
    if (a.tipo === "patrimonio") { t >= 0 ? (val.imovel += t) : (passivos += -t); return; }
    if (a.tipo === "invest") {
      if (temAtivos(a)) {
        const cx = carteiraCaixa(a); cx >= 0 ? (val.caixa += cx) : (passivos += -cx);
        computePositions(a.id).forEach((p) => { const k = val[p.classe] != null ? p.classe : "outro"; val[k] += p.valor; });
      } else { t >= 0 ? (val.rf += t) : (passivos += -t); } // investimento sem ativos detalhados → renda fixa
      return;
    }
    t >= 0 ? (val.caixa += t) : (passivos += -t); // banco/dinheiro → caixa; cartão negativo → passivo
  });
  const bruto = Object.values(val).reduce((s, x) => s + x, 0);
  return { val, bruto, passivos, liquido: bruto - passivos };
}
// posições consolidadas (todas as carteiras), com ganho e a conta de origem
function patPositions() {
  const out = [];
  accounts.filter((a) => !a.arquivada && a.tipo === "invest").forEach((a) => computePositions(a.id).forEach((p) => out.push(Object.assign({ conta: a.nome }, p))));
  return out.sort((x, y) => y.valor - x.valor);
}
// custo/valor/ganho agregados dos ativos (rentabilidade não realizada)
function patRentab() {
  const pos = patPositions();
  const custo = pos.reduce((s, p) => s + p.custo, 0), valor = pos.reduce((s, p) => s + p.valor, 0);
  return { custo, valor, ganho: valor - custo, pct: custo > 0 ? ((valor - custo) / custo) * 100 : 0 };
}
// proventos = receitas cuja categoria/sub casa com dividendo/provento/rendimento/JCP (dinheiro real)
function patProventos() {
  const re = /prov|divid|rendiment|jcp|juros s/i, per = {};
  state.tx.forEach((t) => { if (t.tipo !== "receita") return; if (!re.test(`${t.cat || ""} ${t.sub || ""}`)) return; const k = (t.iso || "").slice(0, 7); if (k) per[k] = (per[k] || 0) + Math.abs(t.valor); });
  const [Y, M] = TODAY_ISO.slice(0, 7).split("-").map(Number), months = [];
  for (let i = 11; i >= 0; i--) { let mm = M - 1 - i, yy = Y; while (mm < 0) { mm += 12; yy--; } months.push(`${yy}-${String(mm + 1).padStart(2, "0")}`); }
  const serie = months.map((k) => ({ ym: k, mes: mesAbbrev(k), valor: Math.round((per[k] || 0) * 100) / 100 }));
  const total12 = serie.reduce((s, x) => s + x.valor, 0), media = total12 / 12;
  return { serie, total12, media, proj: media * 12 };
}
// snapshots p/ a evolução: os registrados + o ponto de hoje (calculado) se ainda não registrado
function patEvolucao() {
  const snaps = patSnaps(), ym = TODAY_ISO.slice(0, 7);
  const arr = snaps.map((x) => ({ ym: x.ym, valor: numOr0(x.liquido) }));
  if (!arr.some((x) => x.ym === ym)) arr.push({ ym, valor: patAlloc().liquido });
  return arr.map((x) => ({ ym: x.ym, mes: mesAbbrev(x.ym), valor: Math.round(x.valor * 100) / 100 }));
}
// últimos N meses (YYYY-MM), do mais antigo ao atual
function ultimosMeses(n) {
  const [Y, M] = TODAY_ISO.slice(0, 7).split("-").map(Number), out = [];
  for (let i = n - 1; i >= 0; i--) { let mm = M - 1 - i, yy = Y; while (mm < 0) { mm += 12; yy--; } out.push(`${yy}-${String(mm + 1).padStart(2, "0")}`); }
  return out;
}
// série da CARTEIRA a mercado (reconstruída do histórico): valor de mercado × custo × rentabilidade,
// mês a mês. Começa no 1º mês com posição. Usada na evolução e na rentabilidade no tempo.
function carteiraSerie(n) {
  const primeiro = assetMoves.map((m) => String(m.iso || "").slice(0, 7)).filter(Boolean).sort()[0];
  if (!primeiro) return [];
  const meses = ultimosMeses(n || 12).filter((ym) => ym >= primeiro);
  return meses.map((ym) => {
    const market = Math.round(investedMarketAt(null, ym) * 100) / 100;
    const cost = Math.round(investedCostAt(null, ym) * 100) / 100;
    return { ym, mes: mesAbbrev(ym), valor: market, custo: cost, ganho: market - cost, pct: cost > 0 ? ((market - cost) / cost) * 100 : 0 };
  });
}
function registrarMes() {
  const ym = TODAY_ISO.slice(0, 7), a = patAlloc();
  const snaps = ((state.prefs.patSnaps || []).filter((x) => x.ym !== ym));
  snaps.push({ ym, liquido: a.liquido, bruto: a.bruto, passivos: a.passivos });
  state.prefs.patSnaps = snaps.sort((x, y) => String(x.ym).localeCompare(String(y.ym)));
  scheduleSave(); renderView();
}
function pctDeltaMes() {
  const snaps = patSnaps(), ym = TODAY_ISO.slice(0, 7), atual = patAlloc().liquido;
  const prev = snaps.filter((x) => x.ym < ym).pop();
  if (!prev || !numOr0(prev.liquido)) return null;
  return ((atual - numOr0(prev.liquido)) / numOr0(prev.liquido)) * 100;
}
const patDelta = (g) => { const cor = g >= 0 ? "var(--pos)" : "var(--neg)"; return `<span style="color:${cor};font-weight:600">${g >= 0 ? "+" : ""}${g.toFixed(1)}%</span>`; };
function viewPatrimonial() {
  const { val, bruto, passivos, liquido } = patAlloc();
  const rent = patRentab(), prov = patProventos(), prem = patPrem();
  const dMes = pctDeltaMes();
  const metas = patMetas();
  // hero
  const hero = `<div class="card pat-hero">
    <div class="pat-hero-l"><span class="pat-eyebrow">Patrimônio líquido</span><div class="pat-big num">${fmt(liquido)}</div>
      <div class="pat-hero-sub">${dMes != null ? `${patDelta(dMes)} no mês` : `<span class="pat-muted">registre um mês pra ver a variação</span>`}${prem.ipca ? ` · <span class="pat-muted">real ${patDelta(dMes != null ? dMes - numOr0(prem.ipca) / 12 : 0)} vs IPCA</span>` : ""}</div>
    </div>
    <button class="mini-btn primary" data-pat-reg>${ic("plus", 14)} Registrar mês</button>
  </div>`;
  // kpis
  const kpis = `<div class="pat-kpis">
    <div class="card pat-kpi"><span>Patrimônio bruto</span><b class="num">${fmt(bruto)}</b></div>
    <div class="card pat-kpi"><span>Passivos</span><b class="num" style="color:var(--neg)">${fmt(passivos)}</b></div>
    <div class="card pat-kpi"><span>Ganho acumulado</span><b class="num" style="color:${rent.ganho >= 0 ? "var(--pos)" : "var(--neg)"}">${rent.ganho >= 0 ? "+" : "−"} ${fmtNum(Math.abs(rent.ganho))}</b></div>
    <div class="card pat-kpi"><span>Rentabilidade (ativos)</span><b>${patDelta(rent.pct)}</b></div>
  </div>`;
  // alocação
  const allocRows = PAT_CLASSES.filter((c) => val[c.key] > 0 || numOr0(metas[c.key]) > 0).map((c) => {
    const v = val[c.key], atual = bruto > 0 ? (v / bruto) * 100 : 0, meta = numOr0(metas[c.key]);
    const d = atual - meta;
    return `<div class="pat-alloc-row">
      <div class="pat-alloc-top"><span class="pat-dot" style="background:${c.cor}"></span><span class="pat-alloc-name">${c.label}</span><span class="pat-alloc-val num">${fmt(v)}</span></div>
      <div class="pat-bar"><div class="pat-bar-fill" style="width:${Math.min(100, atual).toFixed(1)}%;background:${c.cor}"></div>${meta > 0 ? `<div class="pat-bar-meta" style="left:${Math.min(100, meta).toFixed(1)}%"></div>` : ""}</div>
      <div class="pat-alloc-pct"><b>${atual.toFixed(1)}%</b>${meta > 0 ? ` <span class="pat-muted">(${d >= 0 ? "+" : ""}${d.toFixed(1)}% vs meta ${meta.toFixed(0)}%)</span>` : ""}</div>
    </div>`;
  }).join("");
  const alloc = `<div class="card pat-sec"><div class="pat-sec-head"><div><h3>Alocação</h3><span class="card-sub">atual vs. meta · bruto ${fmt(bruto)}</span></div><button class="mini-btn" data-pat-metas>${ic("pencil", 13)} Editar metas</button></div>${allocRows || `<div class="empty-mini">Sem ativos ainda.</div>`}<p class="pat-foot">Traço = meta. Renda Fixa inclui contas de investimento sem ativos detalhados; Caixa = contas correntes + caixa das carteiras; Imóveis/Bens = contas de patrimônio.</p></div>`;
  // evolução do patrimônio líquido (snapshots) + evolução da CARTEIRA a mercado (histórico Yahoo)
  const ev = patEvolucao();
  const cart12 = carteiraSerie(12);
  const evolucao = `<div class="card pat-sec"><div class="pat-sec-head"><div><h3>Evolução patrimonial</h3><span class="card-sub">patrimônio líquido · ${ev.length} ${ev.length === 1 ? "ponto" : "pontos"}</span></div></div>${ev.length >= 2 ? `<div class="pat-chart">${areaChartSVG(ev)}</div>` : `<div class="empty-mini">Clique em “Registrar mês” ao longo do tempo pra montar a curva (hoje: ${fmt(liquido)}).</div>`}</div>`;
  const carteira = `<div class="card pat-sec"><div class="pat-sec-head"><div><h3>Carteira a mercado</h3><span class="card-sub">valor de mercado dos ativos · ${cart12.length ? `${cart12.length} ${cart12.length === 1 ? "mês" : "meses"} (histórico)` : "sem histórico"}</span></div></div>${cart12.length >= 2 ? `<div class="pat-chart">${areaChartSVG(cart12)}</div><p class="pat-foot">Reconstruído da cotação histórica de cada mês × o que você tinha em carteira. Sem histórico de um ticker, usa o custo.</p>` : `<div class="empty-mini">${hasHoldings() ? "Carregando histórico de cotações…" : "Lance ativos numa carteira pra ver a evolução a mercado."}</div>`}</div>`;
  // proventos
  const provMax = Math.max(1, ...prov.serie.map((x) => x.valor));
  const provBars = prov.serie.map((x) => `<div class="pat-pbar" title="${x.mes}: ${fmt(x.valor)}"><div class="pat-pbar-fill" style="height:${(x.valor / provMax * 100).toFixed(1)}%"></div><span>${x.mes.slice(0, 3)}</span></div>`).join("");
  const dy = bruto > 0 ? (prov.proj / bruto) * 100 : 0;
  const proventos = `<div class="card pat-sec"><div class="pat-sec-head"><div><h3>Proventos recebidos</h3><span class="card-sub">renda passiva · 12 meses (de receitas marcadas como dividendo/provento)</span></div></div>
    <div class="pat-prov-kpis"><div><span>Média mensal</span><b class="num">${fmt(prov.media)}</b></div><div><span>Projeção 12m</span><b class="num">${fmt(prov.proj)}</b></div><div><span>DY da carteira</span><b>${patDelta(dy)}</b></div></div>
    ${prov.total12 > 0 ? `<div class="pat-pbars">${provBars}</div>` : `<div class="empty-mini">Nenhum provento detectado. Lance dividendos/rendimentos como receita numa categoria com “provento”/“dividendo” no nome.</div>`}</div>`;
  // rentabilidade real vs IPCA/CDI (premissas opcionais)
  const nominal = rent.pct;
  const realRows = prem.ipca || prem.cdi ? `<div class="pat-rent-grid">
      <div><span>Nominal (ativos)</span><b>${patDelta(nominal)}</b></div>
      ${prem.ipca ? `<div><span>IPCA (12m)</span><b class="pat-muted">${numOr0(prem.ipca).toFixed(1)}%</b></div><div><span>Retorno real</span><b>${patDelta(nominal - numOr0(prem.ipca))}</b></div>` : ""}
      ${prem.cdi ? `<div><span>CDI (12m)</span><b class="pat-muted">${numOr0(prem.cdi).toFixed(1)}%</b></div><div><span>Excesso sobre o CDI</span><b>${patDelta(nominal - numOr0(prem.cdi))}</b></div>` : ""}
    </div>` : `<div class="empty-mini">Informe o IPCA e o CDI acumulados (12m) pra ver o retorno real e o excesso sobre o CDI.</div>`;
  // rentabilidade no tempo (nominal %/mês da carteira, do histórico)
  const rMax = Math.max(1, ...cart12.map((x) => Math.abs(x.pct)));
  const rentSerie = cart12.length >= 2 ? `<div class="pat-rbars">${cart12.map((x) => { const h = (Math.abs(x.pct) / rMax * 100).toFixed(1); const up = x.pct >= 0; return `<div class="pat-rbar" title="${x.mes}: ${x.pct >= 0 ? "+" : ""}${x.pct.toFixed(1)}%"><div class="pat-rbar-track"><div class="pat-rbar-fill ${up ? "up" : "down"}" style="height:${h}%;${up ? "bottom" : "top"}:50%"></div></div><span>${x.mes.slice(0, 3)}</span></div>`; }).join("")}</div><p class="pat-foot">Rentabilidade nominal acumulada (mercado − custo) da carteira em cada mês.</p>` : "";
  const rentab = `<div class="card pat-sec"><div class="pat-sec-head"><div><h3>Rentabilidade</h3><span class="card-sub">ativos · ganho ${rent.ganho >= 0 ? "+" : "−"}${fmtNum(Math.abs(rent.ganho))} (mercado − custo)</span></div><button class="mini-btn" data-pat-prem>${ic("pencil", 13)} Premissas</button></div>${realRows}${rentSerie}</div>`;
  // posições consolidadas
  const pos = patPositions();
  const posRows = pos.map((p) => `<tr data-acct-open="${attr(p.conta)}" class="click"><td><div class="inv-ativo"><span class="inv-tkr">${_esc(p.ticker)}</span><span class="inv-nome">${_esc(p.conta)}</span></div>${p.classe ? `<span class="inv-classe">${CLASSE_LABEL[p.classe] || p.classe}</span>` : ""}</td><td class="num">${(Math.round(p.qtd * 1e6) / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 6 })}</td><td class="num">${fmtNum(p.pm)}</td><td class="num">${p.semCotacao ? "—" : fmtNum(p.cotacao)}</td><td class="num">${fmtNum(p.valor)}</td><td class="num" style="text-align:right">${invGanhoHTML(p.ganho, p.ganhoPct)}</td></tr>`).join("");
  const posicoes = pos.length ? `<div class="card pat-sec"><div class="pat-sec-head"><div><h3>Posições consolidadas</h3><span class="card-sub">${pos.length} ${pos.length === 1 ? "ativo" : "ativos"} · valor ${fmt(rent.valor)} · custo ${fmt(rent.custo)}</span></div></div>
    <div class="inv-tbl-wrap"><table class="inv-tbl"><thead><tr><th>Ativo</th><th class="num">Qtd</th><th class="num">PM</th><th class="num">Atual</th><th class="num">Valor</th><th class="num" style="text-align:right">Result.</th></tr></thead><tbody>${posRows}</tbody></table></div>
    <p class="pat-foot">Clique numa linha pra abrir a conta do ativo.</p></div>` : "";
  return `${hero}${kpis}${alloc}<div class="pat-2col">${evolucao}${carteira}</div><div class="pat-2col">${proventos}${rentab}</div>${posicoes}`;
}

function viewDashboard() {
  const edit = state.dashEdit;
  return `
  <div class="dash-tools">
    <button class="ghost dash-personalize ${edit ? "on" : ""}" data-dash-edit>${ic(edit ? "check" : "sliders", 15)} ${edit ? "Concluir" : "Personalizar página"}</button>
    ${edit ? `<span class="dash-hint">Arraste os blocos ou use as setas para mudar a ordem.</span>` : ""}
  </div>
  ${statementBand()}
  ${edit ? dashEditor() : `<div class="dash-grid">${state.dashOrder.map((k) => DASH_BLOCKS[k].render()).join("")}</div>`}`;
}

const chipLabel = (t) => (t === "cartao" ? "cartão" : t === "invest" ? "investimento" : t);

function acctMenuHTML(a) {
  if (state.acctMenu !== a.id) return "";
  return `<div class="acct-menu">
    <button data-acct-open="${a.nome}">${ic("list", 14)} Ver lançamentos</button>
    <button data-acct-edit="${a.id}">${ic("pencil", 14)} Editar</button>
    <button data-acct-move="${a.id}:up">${ic("chevron-up", 14)} Mover pra cima</button>
    <button data-acct-move="${a.id}:down">${ic("chevron-down", 14)} Mover pra baixo</button>
    <button class="danger" data-acct-archive="${a.id}">${ic("archive", 14)} Arquivar</button>
  </div>`;
}
function acctEditForm(a) {
  return `<div class="acct-edit"><label class="fld-label">Nome da conta</label><input class="acct-edit-input" value="${attr(a.nome)}" data-acct-input="${a.id}"><div class="acct-edit-actions"><button class="mini-btn primary" data-acct-save="${a.id}">Salvar</button><button class="mini-btn" data-acct-cancel>Cancelar</button></div></div>`;
}
function acctCard(a) {
  const kebab = `<button class="acct-kebab" data-acct-menu="${a.id}" title="Opções">${ic("more-vertical", 18)}</button>`;
  const editing = state.acctEdit === a.id;
  if (a.grupo === "pat") {
    const body = `<div class="acct-name">${a.nome}</div><div class="acct-sub">${a.sub}</div><div class="alloc-lines"><div><span>Valor alocado</span><b class="num">${fmt(a.alocado)}</b></div><div><span>Custos lançados</span><b class="num" style="color:${C.despesa}">${fmt(a.custo)}</b></div></div><div class="alloc-val"><span>Valor atual</span><strong class="num" style="color:${C.patrimonio}">${fmt(a.saldo)}</strong></div>`;
    return `<div class="card acct alloc-card"><div class="acct-top"><span class="acct-ic pat">${ic(acctIconOf(a), 18)}</span><div class="acct-top-r"><span class="acct-chip patrimonio">patrimônio</span>${kebab}</div></div>${editing ? acctEditForm(a) : `<div class="acct-body" data-acct-open="${a.nome}">${body}</div>`}${acctMenuHTML(a)}</div>`;
  }
  if (temAtivos(a)) {
    // carteira: total = caixa + investido (a mercado)
    const caixa = carteiraCaixa(a), invest = invInvestido(a), total = acctTotal(a);
    const body = `<div class="acct-name">${a.nome}</div><div class="acct-sub">${a.sub}</div><div class="alloc-lines"><div><span>Caixa</span><b class="num">${fmt(caixa)}</b></div><div><span>Investido (mercado)</span><b class="num">${fmt(invest)}</b></div></div><div class="alloc-val"><span>Total</span><strong class="num" style="color:${total < 0 ? C.despesa : "var(--ink)"}">${fmt(total)}</strong></div>`;
    return `<div class="card acct"><div class="acct-top"><span class="acct-ic">${ic(acctIconOf(a), 18)}</span><div class="acct-top-r"><span class="acct-chip ${a.tipo}">${chipLabel(a.tipo)}</span>${kebab}</div></div>${editing ? acctEditForm(a) : `<div class="acct-body" data-acct-open="${a.nome}">${body}</div>`}${acctMenuHTML(a)}</div>`;
  }
  const saldo = acctTotal(a);
  const body = `<div class="acct-name">${a.nome}</div><div class="acct-sub">${a.sub}</div><div class="acct-saldo num" style="color:${saldo < 0 ? C.despesa : "var(--ink)"}">${fmt(saldo)}</div>`;
  return `<div class="card acct"><div class="acct-top"><span class="acct-ic">${ic(acctIconOf(a), 18)}</span><div class="acct-top-r"><span class="acct-chip ${a.tipo}">${chipLabel(a.tipo)}</span>${kebab}</div></div>${editing ? acctEditForm(a) : `<div class="acct-body" data-acct-open="${a.nome}">${body}</div>`}${acctMenuHTML(a)}</div>`;
}
const MES_NOMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function monthLabel(ym) { const m = +ym.slice(5, 7), y = ym.slice(0, 4); const nm = MES_NOMES[m - 1] || "—"; return `${nm.charAt(0).toUpperCase()}${nm.slice(1)} ${y}`; }
function txCatIcon(t) {
  if (t.tipo === "transferencia") return "transfer";
  const node = catTree[t.tipo === "receita" ? "receita" : "despesa"].find((c) => c.nome === t.cat);
  return node ? catIconOf(node) : catIcon(t.cat);
}
function acctTxRow(t, nome) {
  const v = txValorConta(t, nome);
  const contraparte = t.tipo === "transferencia" ? (t.origem === nome ? `→ ${t.destino}` : `← ${t.origem}`) : `${t.cat}${t.sub ? ` · ${t.sub}` : ""}`;
  const tcor = t.tipo === "transferencia" ? C.transfer : (t.tipo === "despesa" ? C.despesa : C.receita);
  return `<div class="mini-row click txr" data-tx-open="${t.id}"><span class="tx-ic" style="background:${tcor}1A;color:${tcor}">${ic(txCatIcon(t), 16)}</span><div class="tx-mid"><div class="mini-desc">${t.desc}</div><div class="mini-meta">${t.data} · ${contraparte}</div></div><span class="num" style="color:${v < 0 ? "var(--ink)" : "var(--pos)"};font-weight:600">${v < 0 ? "−" : "+"} ${fmtNum(Math.abs(v))}</span></div>`;
}
// linha de compra/venda de ativo no extrato: NÃO é despesa/receita — é reaplicação interna
// (compra = caixa → investido; venda = investido → caixa). Cor de transferência + tag, nunca vermelho.
function acctAssetRow(m) {
  const venda = m.tipo === "venda";
  const eff = (venda ? 1 : -1) * numOr0(m.qtd) * numOr0(m.preco);
  const cor = C.transfer;
  const q = (Math.round(numOr0(m.qtd) * 1e6) / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 6 });
  const dir = venda ? "investido → caixa" : "caixa → investido";
  const tag = venda ? "resgate" : "aplicação";
  return `<div class="mini-row click txr" data-asset-open="${attr(m.id)}"><span class="tx-ic" style="background:${cor}1A;color:${cor}">${ic("transfer", 16)}</span><div class="tx-mid"><div class="mini-desc">${venda ? "Venda" : "Compra"} · ${_esc(m.ticker || "?")} <span class="asset-tag">${tag}</span></div><div class="mini-meta">${m.iso ? dataBR(m.iso) : "—"} · ${q} × ${fmtNum(m.preco)} · ${dir}</div></div><span class="num" style="color:${cor};font-weight:600">${eff < 0 ? "−" : "+"} ${fmtNum(Math.abs(eff))}</span></div>`;
}
// Saldo inicial (abertura) da conta = valor ANTES do 1º lançamento, derivado como
// (saldo/caixa atual − soma de todos os movimentos). É estável: adicionar/remover lançamento
// mexe no saldo e na soma juntos, então a abertura não muda. Editá-la re-baseia o saldo (sobe a
// reconstrução inteira), fechando meses negativos por histórico importado incompleto.
function acctMovSum(a) {
  if (!a) return 0;
  let s = 0;
  acctTx(a.nome).forEach((t) => { s += txValorConta(t, a.nome); });
  if (temAtivos(a)) assetMoves.filter((m) => m.contaId === a.id).forEach((m) => { s += (m.tipo === "venda" ? 1 : -1) * numOr0(m.qtd) * numOr0(m.preco); });
  return s;
}
const acctAnchor = (a) => (temAtivos(a) ? carteiraCaixa(a) : acctTotal(a));
const aberturaAtual = (a) => Math.round((acctAnchor(a) - acctMovSum(a)) * 100) / 100;
// posições mantidas ao FIM do mês `ym` (YYYY-MM): replay das compras/vendas até ali. contaId=null ⇒
// consolida todas as carteiras. Retorna { TICKER: {qtd, custo} } (só quem tem qtd > 0).
function heldAt(contaId, ym) {
  const moves = assetMoves
    .filter((m) => (contaId == null || m.contaId === contaId) && String(m.iso || "").slice(0, 7) <= ym)
    .slice().sort((a, b) => String(a.iso || "").localeCompare(String(b.iso || "")));
  const pos = {};
  moves.forEach((m) => {
    const k = String(m.ticker || "?").toUpperCase();
    const o = pos[k] || (pos[k] = { qtd: 0, custo: 0 });
    const q = numOr0(m.qtd), pr = numOr0(m.preco);
    if (m.tipo === "venda") { const pm = o.qtd > 0 ? o.custo / o.qtd : 0; const qv = Math.min(q, o.qtd); o.custo -= pm * qv; o.qtd -= qv; }
    else { o.qtd += q; o.custo += pr * q; }
  });
  const out = {};
  Object.keys(pos).forEach((k) => { if (pos[k].qtd > 1e-9) out[k] = pos[k]; });
  return out;
}
// custo investido ao fim do mês (soma dos custos das posições mantidas).
function investedCostAt(contaId, ym) {
  const held = heldAt(contaId, ym);
  return Object.values(held).reduce((s, o) => s + o.custo, 0);
}
// VALOR DE MERCADO investido ao fim do mês: qtd × cotação histórica daquele mês (histPriceAt).
// Sem histórico p/ um ticker, cai no custo daquela posição (nunca inventa). contaId=null = tudo.
function investedMarketAt(contaId, ym) {
  const held = heldAt(contaId, ym);
  return Object.keys(held).reduce((s, tk) => {
    const o = held[tk], price = histPriceAt(tk, ym);
    const pm = o.qtd > 0 ? o.custo / o.qtd : 0;
    return s + o.qtd * (price != null ? price : pm);
  }, 0);
}
function viewAcctDetail(nome) {
  const a = accounts.find((x) => x.nome === nome);
  const cart = temAtivos(a); // carteira de investimento: separa caixa × investido
  // ledger unificado: transações + (se carteira) compras/vendas de ativo como linhas de caixa
  const items = [];
  acctTx(nome).forEach((t) => items.push({ iso: t.iso || "", data: t.data || "", eff: txValorConta(t, nome), html: acctTxRow(t, nome), asset: false }));
  if (cart) assetMoves.filter((m) => m.contaId === a.id).forEach((m) => items.push({ iso: m.iso || "", data: m.iso ? dataBR(m.iso) : "", eff: (m.tipo === "venda" ? 1 : -1) * numOr0(m.qtd) * numOr0(m.preco), html: acctAssetRow(m), asset: true }));
  items.sort((x, y) => String(y.iso || y.data).localeCompare(String(x.iso || x.data)));
  // Entradas/Saídas = só caixa real (aportes/saques/receitas/despesas). Compra/venda de ativo é
  // reaplicação interna (caixa↔investido), não conta como entrada nem saída.
  let entradas = 0, saidas = 0;
  items.forEach((it) => { if (it.asset) return; if (it.eff >= 0) entradas += it.eff; else saidas += -it.eff; });
  const groups = {};
  items.forEach((it) => { const k = (it.iso || "0000-00").slice(0, 7); (groups[k] = groups[k] || []).push(it); });
  const keys = Object.keys(groups).sort((x, y) => y.localeCompare(x));
  // saldo/caixa ao FIM de cada mês: âncora = saldo atual (conta normal) ou caixa atual (carteira),
  // descontando os movimentos posteriores (os meses vêm do mais novo p/ o mais antigo).
  const anchor = acctAnchor(a);
  const balLabel = cart ? "caixa" : "saldo";
  const totalMov = items.reduce((s, it) => s + it.eff, 0);
  const abertura = Math.round((anchor - totalMov) * 100) / 100;
  let after = 0;
  const body = (items.length ? keys.map((k) => {
    const list = groups[k], net = list.reduce((s, it) => s + it.eff, 0);
    const lbl = k === "0000-00" ? "Sem data" : monthLabel(k + "-01");
    const fim = Math.round((anchor - after) * 100) / 100;
    after += net;
    let balHTML = "";
    if (k !== "0000-00") {
      if (cart) {
        const invM = investedMarketAt(a.id, k);   // ativos a valor de mercado (cotação histórica)
        const invC = investedCostAt(a.id, k);      // ativos a custo (o que foi aplicado)
        const totMes = Math.round((fim + invM) * 100) / 100; // total da conta no fim do mês = caixa + ativos a mercado
        balHTML = `<span class="md-bal">caixa <b class="num">${fmt(fim)}</b></span><span class="md-bal">aplicado <b class="num">${fmt(invC)}</b></span><span class="md-bal">mercado <b class="num">${fmt(invM)}</b></span><span class="md-bal md-bal-tot">total <b class="num">${fmt(totMes)}</b></span>`;
      } else {
        balHTML = `<span class="md-bal">${balLabel} <b class="num">${fmt(fim)}</b></span>`;
      }
    }
    return `<div class="month-div"><span class="md-label">${lbl}</span><span class="md-count">${list.length} ${list.length === 1 ? "lançamento" : "lançamentos"}</span><span class="md-net num" style="color:${net >= 0 ? "var(--pos)" : "var(--neg)"}">${net >= 0 ? "+" : "−"} ${fmtNum(net)}</span>${balHTML}</div>${list.map((it) => it.html).join("")}`;
  }).join("") : `<div class="empty-mini">Nenhum lançamento nesta conta ainda.</div>`)
    // linha de abertura (saldo/caixa inicial), no rodapé — editável p/ fechar histórico incompleto
    + `<div class="month-div abertura-row"><span class="md-label">${cart ? "Caixa inicial" : "Saldo inicial"}</span><span class="md-count">antes do 1º lançamento${abertura < 0 ? ` · <span class="ab-warn">histórico incompleto?</span>` : ""}</span><span class="md-bal"><b class="num">${fmt(abertura)}</b></span><button class="mini-btn xs" data-abertura="${attr(nome)}">${ic("pencil", 11)} ajustar</button></div>`;
  const iconName = acctIconOf(a);
  const headVal = cart
    ? `<div class="adh-cart"><div><span>Caixa</span><b class="num">${fmt(carteiraCaixa(a))}</b></div><div><span>Investido</span><b class="num">${fmt(invInvestido(a))}</b></div><div class="adh-cart-tot"><span>Total</span><strong class="num">${fmt(acctTotal(a))}</strong></div></div>`
    : `<div class="adh-saldo num" style="color:${a && acctTotal(a) < 0 ? "var(--neg)" : "var(--ink)"}">${a ? fmt(acctTotal(a)) : ""}</div>`;
  const ativos = (a && a.tipo === "invest") ? invAtivosSection(a) : ""; // ativos vivem na página da própria conta
  return `
  <button class="back-btn" data-acct-back>${ic("arrow-left", 16)} Contas</button>
  <div class="card acct-detail-head"><div class="adh-l"><span class="acct-ic big">${ic(iconName, 22)}</span><div><div class="adh-name">${nome}</div><div class="acct-sub">${a ? a.sub : ""}</div></div></div>${headVal}</div>
  ${ativos}
  <div class="adh-stats">
    <div class="card adh-stat"><span>Entradas</span><b class="num" style="color:var(--pos)">${fmt(entradas)}</b></div>
    <div class="card adh-stat"><span>Saídas</span><b class="num" style="color:var(--neg)">${fmt(saidas)}</b></div>
    <div class="card adh-stat"><span>Lançamentos</span><b class="num">${items.length}</b></div>
  </div>
  <div class="card table-card" style="padding:6px 18px"><div class="card-head" style="padding:12px 2px 4px"><div><h3>Lançamentos</h3>${cart ? `<span class="card-sub">Compra/venda de ativo é reaplicação (caixa ↔ investido), não despesa/receita.</span>` : ""}</div></div><div class="mini-list">${body}</div></div>`;
}
function viewContas() {
  if (state.acctDetail) return viewAcctDetail(state.acctDetail);
  const active = accounts.filter((a) => !a.arquivada);
  const fin = active.filter((a) => a.grupo === "fin");
  const pat = active.filter((a) => a.grupo === "pat");
  const archived = accounts.filter((a) => a.arquivada);
  const archBlock = archived.length ? `
  <div class="section-lead alloc"><div><span class="lead-eyebrow" style="color:var(--subtle)">Arquivadas</span><p>Ocultas do dia a dia e fora do patrimônio. Reative quando quiser.</p></div></div>
  <div class="archived-list">${archived.map((a) => `<div class="arch-row"><span class="acct-ic small">${ic(acctIconOf(a), 16)}</span><div class="arch-info"><div class="arch-name">${a.nome}</div><div class="acct-sub">${a.sub}</div></div><span class="num arch-saldo">${fmt(acctTotal(a))}</span><button class="mini-btn" data-acct-archive="${a.id}">${ic("archive", 13)} Desarquivar</button></div>`).join("")}</div>` : "";
  return `
  <div class="section-lead"><div><span class="lead-eyebrow" style="color:${C.brand}">Contas financeiras</span><p>Clique numa conta pra ver os lançamentos dela. Use o ⋯ pra editar o nome, reordenar ou arquivar.</p></div></div>
  <div class="acct-grid">${fin.map(acctCard).join("")}</div>
  <div class="section-lead alloc"><div><span class="lead-eyebrow" style="color:${C.patrimonio}">Alocações de patrimônio</span><p>Comprar um bem não é despesa: você transfere o dinheiro pra cá e ele vira patrimônio.</p></div></div>
  <div class="acct-grid">${pat.map(acctCard).join("")}<button class="card acct add-acct" data-add-acct>${ic("plus", 22)}<span>Nova conta ou alocação</span></button></div>
  ${archBlock}`;
}

/* ---------- Investimentos: carteiras de ativos (marcação a mercado) ---------- */
function invQuoteLabel() {
  if (!quotesTs) return "cotações ainda não atualizadas";
  const d = new Date(quotesTs), hoje = d.toISOString().slice(0, 10) === TODAY_ISO;
  const hh = String(d.getHours()).padStart(2, "0"), mm = String(d.getMinutes()).padStart(2, "0");
  return `cotações de ${hoje ? "hoje" : dataBR(d.toISOString().slice(0, 10))} às ${hh}:${mm}`;
}
function invGanhoHTML(g, pct, big) {
  const cor = g >= 0 ? "var(--pos)" : "var(--neg)", sig = g >= 0 ? "+" : "−";
  const p = pct != null && isFinite(pct) ? ` <span class="inv-pct">${g >= 0 ? "+" : ""}${pct.toFixed(1)}%</span>` : "";
  return `<span class="num${big ? " inv-big" : ""}" style="color:${cor};font-weight:600">${sig} ${fmtNum(Math.abs(g))}${p}</span>`;
}
function invPosRow(p) {
  const cot = p.semCotacao ? `<span class="inv-nocot" title="Sem cotação na fonte — usando o custo">—</span>` : fmtNum(p.cotacao);
  const qtd = (Math.round(p.qtd * 1e6) / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 6 });
  return `<tr>
    <td><div class="inv-ativo"><span class="inv-tkr">${_esc(p.ticker)}</span>${p.nome ? `<span class="inv-nome">${_esc(p.nome)}</span>` : ""}</div>${p.classe ? `<span class="inv-classe">${CLASSE_LABEL[p.classe] || p.classe}</span>` : ""}</td>
    <td class="num">${qtd}</td>
    <td class="num">${fmtNum(p.pm)}</td>
    <td class="num">${cot}</td>
    <td class="num">${fmtNum(p.valor)}</td>
    <td class="num" style="text-align:right">${invGanhoHTML(p.ganho, p.ganhoPct)}</td>
  </tr>`;
}
// Seção de ativos EMBUTIDA na página da própria conta (carteira). Posições + lançar + cotações.
function invAtivosSection(a) {
  const pos = computePositions(a.id);
  const custo = pos.reduce((s, p) => s + p.custo, 0);
  const valor = pos.reduce((s, p) => s + p.valor, 0);
  const ganho = valor - custo, pct = custo > 0 ? (ganho / custo) * 100 : 0;
  const table = pos.length ? `
    <div class="inv-tbl-wrap"><table class="inv-tbl">
      <thead><tr><th>Ativo</th><th class="num">Qtd</th><th class="num">PM</th><th class="num">Cotação</th><th class="num">Valor</th><th class="num" style="text-align:right">Ganho</th></tr></thead>
      <tbody>${pos.map(invPosRow).join("")}</tbody>
    </table></div>` : `<div class="empty-mini">Nenhum ativo lançado ainda. Clique em “Lançar ativo” pra registrar o que está dentro desta conta.</div>`;
  return `<div class="card inv-cart">
    <div class="inv-sec-head"><div><h3>Ativos</h3><span class="card-sub">${pos.length ? `${pos.length} ${pos.length === 1 ? "ativo" : "ativos"} · custo ${fmt(custo)} · ${invQuoteLabel()}` : invQuoteLabel()}</span></div>${pos.length ? `<div class="inv-sec-val"><div class="num inv-big">${fmt(valor)}</div>${invGanhoHTML(ganho, pct)}</div>` : ""}</div>
    ${table}
    <div class="inv-cart-actions">
      <button class="mini-btn primary" data-inv-add="${a.id}">${ic("plus", 14)} Lançar ativo</button>
      ${pos.length ? `<button class="mini-btn" data-inv-moves="${a.id}">${ic("list", 14)} Lançamentos</button>` : ""}
      <button class="mini-btn" data-inv-refresh>${ic("undo", 13)} Atualizar cotações</button>
    </div>
  </div>`;
}

function viewTransacoes() {
  const chips = ["todas", "receita", "despesa", "transferencia", "reembolso"];
  const CAP = 300;
  const filtered = state.tx.filter((t) => state.filter === "todas" || t.tipo === state.filter);
  const shown = filtered.slice(0, CAP);
  const rows = shown.map((t) => {
    const cat = t.tipo === "transferencia"
      ? `<span class="transfer-path">${t.origem} ${ic("arrow-right", 12)} ${t.destino}</span>`
      : `<span>${t.cat}${t.sub ? ` <span class="dot">·</span> <span class="muted2">${t.sub}</span>` : ""}</span>`;
    const conta = t.tipo === "transferencia" ? (t.nota || "—") : t.conta;
    const status = t.status === "conciliado" ? `<span class="status conciliado">${ic("check", 11)} conciliado</span>` : `<span class="status pendente">pendente</span>`;
    return `<tr class="tx-tr" data-tx-open="${t.id}"><td class="num muted">${t.data}</td><td><div class="td-desc">${t.desc}</div>${badgeHTML(t.tipo, true)}</td><td class="muted">${cat}</td><td class="muted">${conta}</td><td class="r">${moneyHTML(t.tipo, t.valor)}</td><td class="c">${status}</td></tr>`;
  }).join("");
  const capNote = filtered.length > CAP ? `<p class="foot-note">Mostrando os <b>${CAP}</b> lançamentos mais recentes de <b>${filtered.length}</b>.</p>` : "";
  const filters = chips.map((f) => {
    const on = state.filter === f;
    const style = on && f !== "todas" ? `style="background:${TIPOS[f].cor}1A;color:${TIPOS[f].cor};border-color:${TIPOS[f].cor}55"` : "";
    return `<button class="chip ${on ? "on" : ""}" data-filter="${f}" ${style}>${f === "todas" ? "Todas" : TIPOS[f].label}</button>`;
  }).join("");
  return `
  <div class="filters">${filters}</div>
  <div class="card table-card"><table class="tbl"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th class="r">Valor</th><th class="c">Status</th></tr></thead><tbody>${rows}</tbody></table></div>
  ${capNote}
  <p class="foot-note"><span style="color:${C.transfer}">${ic("transfer", 13)}</span> Transferências aparecem na lista, mas <b>não somam em receitas nem despesas</b> — só movem saldo entre contas.</p>`;
}

function reconEffect(r) {
  if (r.sug.tipo === "transferencia") { if (r.sug.destino === state.reconAccount) return Math.abs(r.valor); if (r.sug.origem === state.reconAccount) return -Math.abs(r.valor); return 0; }
  return r.valor; // já assinado (despesa negativa, receita positiva)
}
// avaliador aritmético seguro (só + − × ÷ e parênteses), SEM eval/Function. Recebe uma expressão
// já normalizada (ponto = decimal). Descida recursiva; devolve `null` em qualquer coisa inválida
// (token sobrando, operador solto, divisão que não converge). Usado pelo campo de saldo do banco,
// pra dar poder de calculadora ao batimento ("100+50", "1.234,56-30", …).
function evalArith(expr) {
  const toks = expr.match(/\d+(?:\.\d+)?|\.\d+|[-+*/()]/g);
  if (!toks) return null;
  let i = 0;
  const peek = () => toks[i], eat = () => toks[i++];
  function factor() {
    const t = peek();
    if (t === "+" || t === "-") { eat(); const r = factor(); return r === null ? null : (t === "-" ? -r : r); }
    if (t === "(") { eat(); const v = expr2(); if (v === null || peek() !== ")") return null; eat(); return v; }
    if (t != null && /^[\d.]/.test(t)) { eat(); const n = parseFloat(t); return isFinite(n) ? n : null; }
    return null;
  }
  function term() {
    let v = factor();
    if (v === null) return null;
    while (peek() === "*" || peek() === "/") { const op = eat(); const r = factor(); if (r === null) return null; v = op === "*" ? v * r : v / r; }
    return v;
  }
  function expr2() {
    let v = term();
    if (v === null) return null;
    while (peek() === "+" || peek() === "-") { const op = eat(); const r = term(); if (r === null) return null; v = op === "+" ? v + r : v - r; }
    return v;
  }
  const v = expr2();
  if (v === null || i < toks.length) return null; // sobrou token ⇒ expressão malformada
  return isFinite(v) ? v : null;
}
// saldo digitado pelo usuário (copiado do app do banco): aceita "1.234,56", "1234,56", "1234.56",
// "R$ 1.234,56", negativo com "-" ou entre parênteses, E contas ("100+50", "1.234,56-30").
// `null` = campo vazio/inválido (não confere nada).
function parseSaldo(s) {
  let t = String(s == null ? "" : s).replace(/[R$\s]/gi, "").replace(/[−–—]/g, "-").replace(/[x×]/gi, "*").replace(/[÷]/g, "/");
  if (!/\d/.test(t)) return null;
  // é uma conta? (tem operador além de um possível sinal inicial, ou parênteses de agrupamento)
  const isExpr = /[+*/]/.test(t.replace(/^[+-]/, "")) || /\d\s*-/.test(t) || /\)\s*-/.test(t) || /\([^)]*[-+*/]/.test(t);
  if (isExpr) {
    // normaliza cada literal pro formato JS: vírgula decimal vira ponto (e some o ponto de milhar);
    // sem vírgula, mantém o ponto como decimal. Operadores/parênteses passam intactos.
    const norm = t.replace(/[\d.,]+/g, (m) => (m.indexOf(",") >= 0 ? m.replace(/\./g, "").replace(",", ".") : m));
    return evalArith(norm);
  }
  const neg = t.indexOf("-") >= 0 || (t.indexOf("(") >= 0 && t.indexOf(")") >= 0);
  t = t.replace(/[()\-]/g, "");
  t = /,\d{1,2}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  const n = parseFloat(t);
  if (!isFinite(n)) return null;
  return neg ? -n : n;
}
// totais da conta em conciliação. Fora da view porque o batimento (`recon-check`) recalcula a cada
// tecla sem re-renderizar a tela (senão o input perderia o foco/cursor a cada dígito).
function reconTotals() {
  const acct = accounts.find((a) => a.nome === state.reconAccount);
  const saldoAtual = acct ? numOr0(acct.saldo) : 0;
  const contam = state.recon.filter((r) => r.status !== "ignorado");
  let despTot = 0, credTot = 0;
  contam.forEach((r) => { const e = reconEffect(r); if (e < 0) despTot += e; else credTot += e; });
  return { acct, saldoAtual, contam, despTot, credTot, saldoFuturo: saldoAtual + despTot + credTot };
}
// diferença = saldo do banco − saldo projetado. Zero ⇒ bate na vírgula.
function reconDiff() {
  const banco = parseSaldo(state.reconBank);
  const { saldoFuturo } = reconTotals();
  if (banco === null) return { banco: null, saldoFuturo, diff: 0, ok: false };
  const diff = Math.round((banco - saldoFuturo) * 100) / 100;
  return { banco, saldoFuturo, diff, ok: diff === 0 };
}
function reconDiffHTML() {
  const d = reconDiff();
  if (d.banco === null) return `<span class="rc-idle">${ic("circle-alert", 14)} Informe o saldo do banco pra ver quanto falta.</span>`;
  const conta = `<span class="rc-calc">banco ${fmt(d.banco)} − projetado ${fmt(d.saldoFuturo)}</span>`;
  if (d.ok) return `<div class="rc-ok">${ic("check", 16)} <b>Bate na vírgula</b></div>${conta}`;
  const tip = d.diff > 0
    ? `falta lançar <b>${fmtNum(d.diff)}</b> de entrada nesta conta — o banco tem mais do que o MeuCaixa prevê`
    : `falta lançar <b>${fmtNum(d.diff)}</b> de despesa nesta conta — o banco tem menos do que o MeuCaixa prevê`;
  // atalho: cria um lançamento de ajuste (plug) exatamente do valor da diferença, pra aceitar ou
  // não. Positivo ⇒ receita; negativo ⇒ despesa. Some assim que a diferença zera (self-limiting).
  const plug = `<button class="rc-plug" data-recon-plug>${ic("plus", 14)} Lançar a diferença de ${fmtNum(d.diff)} como ${d.diff > 0 ? "receita" : "despesa"}</button>`;
  return `<div class="rc-diff"><span>Diferença</span><b class="num" style="color:${d.diff > 0 ? "var(--pos)" : "var(--neg)"}">${d.diff > 0 ? "+ " : "− "}${fmtNum(d.diff)}</b></div>${conta}<span class="rc-tip">${tip}</span>${plug}`;
}
// atualiza só o resultado do batimento, preservando o input (foco + cursor) durante a digitação
function refreshReconDiff() {
  const box = document.querySelector("[data-recon-diff]");
  if (box) box.innerHTML = reconDiffHTML();
}
function viewConciliacao() {
  if (!state.imported) {
    if (!state.reconAccount) state.reconAccount = (accounts.find((a) => !a.arquivada) || {}).nome;
    const opts = accounts.filter((a) => !a.arquivada).map((a) => `<option ${a.nome === state.reconAccount ? "selected" : ""}>${a.nome}</option>`).join("");
    const files = state.reconFiles;
    const totalN = files.reduce((s, f) => s + (Array.isArray(f.parsed) ? f.parsed.length : 0), 0);
    const fileSub = (f) => f.parsed === null ? "lendo…" : f.parsed === "unsupported" ? "sem leitura automática deste formato" : `${f.parsed.length} lançamento${f.parsed.length === 1 ? "" : "s"}`;
    const list = files.length
      ? `<div class="imp-file-list">${files.map((f, i) => `<div class="imp-file-row"><span class="imp-file-ic">${ic("receipt", 18)}</span><div class="imp-drop-txt"><b>${f.name}</b><span>${fileSub(f)}</span></div><button class="imp-file-x" data-imp-clear="${i}" title="Remover">${ic("x", 15)}</button></div>`).join("")}</div>`
      : "";
    // se o usuário informou o saldo do banco, o banner fecha o batimento: saldo da conta agora
    // (já com os lançamentos criados) vs. banco — zero significa tudo lançado
    const bat = state.reconDone && state.reconDone.bat;
    const batTxt = !bat ? "" : bat.falta === 0
      ? ` <b class="rdb-ok">Bate na vírgula com o banco (${fmt(bat.banco)}).</b>`
      : ` Ainda há <b class="rdb-off">${fmtNum(bat.falta)}</b> de diferença com o banco — falta lançar ${bat.falta > 0 ? "entrada" : "despesa"} (banco ${fmt(bat.banco)} · MeuCaixa ${fmt(bat.saldo)}).`;
    const doneBanner = state.reconDone ? `<div class="recon-done-banner card">${ic("check", 16)} <div>Conciliação salva — <b>${state.reconDone.criados}</b> ${state.reconDone.criados === 1 ? "lançamento criado" : "lançamentos criados"}${state.reconDone.dup ? ` · ${state.reconDone.dup} ${state.reconDone.dup === 1 ? "tinha" : "tinham"} correspondência e ${state.reconDone.dup === 1 ? "foi lançado" : "foram lançados"} mesmo assim` : ""}.${batTxt}</div><button class="rdb-x" data-recon-done-x title="Fechar">${ic("x", 14)}</button></div>` : "";
    const drop = `<div class="import-drop" data-imp-drop><input type="file" data-imp-file accept=".ofx,.csv,.pdf,.xls,.xlsx,.qif,.txt" multiple hidden><span class="imp-file-ic">${ic("upload", 22)}</span><div class="imp-drop-txt"><b>${files.length ? "Adicionar outro arquivo" : "Arraste o(s) arquivo(s) aqui"}</b><span>${files.length ? "arraste ou clique para incluir mais" : "ou clique para escolher (pode ser mais de um)"}</span></div></div>`;
    return `${doneBanner}<div class="import-zone card">
      <h3>Importar extrato</h3>
      <p>Escolha a conta e envie um ou mais arquivos do banco (OFX · CSV · PDF · Excel · QIF). O MeuCaixa lê as transações e já sugere categoria, conta e correspondências com o que você lançou.</p>
      <div class="import-form">
        <label class="fld"><span class="fld-label">Conta</span><select data-imp-acct>${opts}</select></label>
        <div class="fld"><span class="fld-label">Arquivos${files.length ? ` (${files.length})` : ""}</span>${list}${drop}</div>
      </div>
      <button class="cta big" data-action="import" ${totalN > 0 ? "" : "disabled"}>${ic("sparkles", 16)} ${totalN > 0 ? `Importar ${totalN} lançamentos${files.length > 1 ? ` de ${files.length} arquivos` : ""}` : "Adicione um arquivo para importar"}</button>
      <button class="recon-skip-file" data-action="recon-empty">${ic("arrow-right", 14)} Prosseguir sem arquivo — só conferir o saldo ou lançar à mão</button>
      <span class="import-formats">Mercado Pago · Nubank · Caixa · Itaú · Bradesco · Inter · e outros</span>
    </div>`;
  }
  const conc = state.recon.filter((r) => r.status === "conciliado").length;
  const totalR = state.recon.filter((r) => r.status !== "ignorado").length;
  const ign = state.recon.filter((r) => r.status === "ignorado").length;
  // saldo projetado = saldo atual + TODOS os itens não-ignorados. Os com correspondência a um lançamento
  // existente já vêm ignorados (X) por padrão — logo não somam por padrão —, mas se o usuário reativar
  // ou aceitar um deles, ele passa a contar. Só o X (ignorar) tira do projetado.
  const { acct, saldoAtual, contam, despTot, credTot, saldoFuturo } = reconTotals();
  const head = `<div class="card recon-head">
    <div class="rh-l"><span class="acct-ic">${ic(acct ? acctIconOf(acct) : "wallet", 18)}</span><div><div class="rh-label">Conciliando</div><div class="rh-acct">${state.reconAccount || "—"}</div></div></div>
    <div class="rh-bals">
      <div class="rh-bal"><span>Saldo atual</span><b class="num">${fmt(saldoAtual)}</b></div>
      <div class="rh-bal"><span>Despesas a lançar</span><b class="num" style="color:var(--neg)">${fmt(despTot)}</b></div>
      <div class="rh-bal"><span>Créditos / pagamentos</span><b class="num" style="color:var(--pos)">+ ${fmtNum(credTot)}</b></div>
      <div class="rh-bal accent"><span>Saldo projetado (${contam.length})</span><b class="num" style="color:${saldoFuturo >= saldoAtual ? "var(--pos)" : "var(--neg)"}">${fmt(saldoFuturo)}</b></div>
    </div>
  </div>`;
  // batimento: o usuário digita o saldo que o app do banco mostra e o MeuCaixa faz
  // banco − projetado. Zero = está tudo lançado. O resultado se atualiza a cada tecla via
  // refreshReconDiff (re-renderizar a view inteira mataria o foco no input).
  const check = `<div class="card recon-check">
    <div class="rc-in">
      <label class="fld"><span class="fld-label">Saldo no banco</span><input inputmode="text" data-recon-bank value="${attr(state.reconBank || "")}" placeholder="ex.: 1.234,56 ou 100+50"></label>
      <span class="rc-hint">o saldo que você vê no app do banco — pode digitar contas (ex.: 100+50)</span>
    </div>
    <div class="rc-eq">${ic("arrow-right", 16)}</div>
    <div class="rc-out" data-recon-diff>${reconDiffHTML()}</div>
  </div>`;
  const saveLabel = conc ? `Salvar ${conc} lançamento${conc > 1 ? "s" : ""}` : "Nada para salvar";
  // resumo honesto do que veio no arquivo: quantos são novos e quantos já existiam. Sem isso, um
  // extrato inteiramente já lançado (reimportação) aparecia só como "0 de 0 conciliados" + botão
  // desabilitado — parecia que a importação tinha falhado.
  const nLidos = state.recon.filter((r) => !r.manual).length;
  const jaExistem = state.recon.filter((r) => r.match).length;
  const puladas = state.recon.filter((r) => !r.match && r.pulado).length;
  const novosTot = state.recon.filter((r) => !r.match && !r.pulado).length;
  const pend = state.recon.filter((r) => r.status === "pendente").length;
  const nManuais = state.recon.filter((r) => r.manual).length;
  // "sem arquivo": entrou pra conferir saldo / lançar à mão (nenhum extrato lido). Não faz sentido
  // "0 lançamentos lidos" nem "0 de 0 conciliados" — mostra um texto próprio.
  const semArquivo = nLidos === 0;
  const resumo = semArquivo
    ? `<div class="recon-sum">Confira o saldo no banco acima e adicione o que estiver faltando${nManuais ? ` · <b>${nManuais}</b> ${nManuais === 1 ? "lançamento manual" : "lançamentos manuais"}` : ""}.</div>`
    : `<div class="recon-sum"><b>${nLidos}</b> ${nLidos === 1 ? "lançamento lido" : "lançamentos lidos"} · <b>${novosTot}</b> ${novosTot === 1 ? "novo" : "novos"} · <b>${jaExistem}</b> já ${jaExistem === 1 ? "existia" : "existiam"} no MeuCaixa${puladas ? ` · <b>${puladas}</b> ${puladas === 1 ? "parcela pulada" : "parcelas puladas"}` : ""}</div>`;
  // aviso de extrato já importado: diz quantos já existem e de quando são, e dá a saída explícita
  // (importar mesmo assim). O ✕ é só a proteção padrão — a decisão continua sendo do usuário.
  const dupsAbertos = state.recon.filter((r) => r.match && r.status === "ignorado" && !r.pulado).length;
  let jaImportado = "";
  if (jaExistem) {
    const isos = state.recon.filter((r) => r.match).map((r) => { const t = state.tx.find((x) => x.id === r.matchId); return (t && t.iso) || r.iso || ""; }).filter(Boolean).sort();
    const periodo = isos.length ? (isos[0] === isos[isos.length - 1] ? `de ${dataFullBR(isos[0])}` : `de ${dataFullBR(isos[0])} a ${dataFullBR(isos[isos.length - 1])}`) : "";
    const tudo = novosTot === 0;
    jaImportado = `<div class="card recon-dup">${ic("circle-alert", 18)}<div>
      <b>${tudo ? "Este extrato já foi importado." : "Parte deste extrato já foi importada."}</b>
      <span><b>${jaExistem}</b> ${jaExistem === 1 ? "lançamento já existe" : `dos ${nLidos} lançamentos já existem`} no MeuCaixa ${periodo}${puladas ? ` · ${puladas} ${puladas === 1 ? "é parcela seguinte (o total entrou na 1ª)" : "são parcelas seguintes (o total entrou na 1ª)"}` : ""}. Vieram com ✕ pra não duplicar${tudo ? "" : `, e os ${novosTot} novos estão pendentes abaixo`}.</span>
      ${dupsAbertos ? `<button class="mini-btn" data-recon-accept-dup>${ic("check", 14)} Importar mesmo assim os ${dupsAbertos} já existentes</button>` : ""}
    </div></div>`;
  }
  const acceptAll = pend ? `<button class="ghost" data-recon-accept-all>${ic("check", 14)} Aceitar ${pend} ${pend === 1 ? "pendente" : "pendentes"}</button>` : "";
  const progHead = state.recon.length === 0
    ? `<strong>Conferência de saldo</strong><span>sem arquivo</span>`
    : `<strong>${conc} de ${totalR} conciliados</strong><span>${ign} ignorados</span>`;
  const voltarLabel = semArquivo ? "Importar arquivo" : "Reimportar";
  const bar = head + check + jaImportado + `<div class="recon-bar card"><div class="recon-prog"><div class="recon-prog-head">${progHead}</div><div class="bar"><span style="width:${totalR ? (conc / totalR) * 100 : 0}%"></span></div>${resumo}</div><div class="recon-bar-acts"><button class="ghost" data-action="reimport">${voltarLabel}</button>${acceptAll}<button class="recon-save" data-recon-commit ${conc ? "" : "disabled"}>${ic("check", 15)} ${saveLabel}</button></div></div>`;
  const list = state.recon.map((r) => {
    const confCor = r.conf >= 90 ? C.receita : r.conf >= 75 ? C.patrimonio : C.despesa;
    const done = r.status === "conciliado", skip = r.status === "ignorado", isEdit = state.editing === r.id;
    const catList = r.sug.tipo === "receita" ? catTree.receita : catTree.despesa;
    const curCat = catList.find((c) => c.nome === r.sug.cat);
    const subs = curCat ? curCat.subs : [];
    const sug = !isEdit
      ? `<div class="sug-body">${badgeHTML(r.sug.tipo, true)}${r.sug.tipo === "transferencia" ? `<span class="sug-cat">${r.sug.origem} ${ic("arrow-right", 12)} ${r.sug.destino}</span>` : `<span class="sug-cat">${r.sug.cat}${r.sug.sub ? ` <span class="dot">·</span> <span class="muted2">${r.sug.sub}</span>` : ""} <span class="dot">·</span> ${r.sug.conta}</span>`}</div>`
      : `<div class="edit-body">
          <input data-recon-field="desc" value="${attr(r.raw)}" placeholder="Descrição">
          <div class="edit-row"><select data-recon-field="tipo">${Object.keys(TIPOS).map((k) => `<option ${k === r.sug.tipo ? "selected" : ""}>${TIPOS[k].label}</option>`).join("")}</select><input type="date" data-recon-field="data" value="${r.iso || ""}"></div>
          ${r.sug.tipo === "transferencia"
            ? `<div class="edit-row edit-tf"><select data-recon-field="origem">${acctOptions(r.sug.origem || r.sug.conta || state.reconAccount)}</select><span class="tf-mini">${ic("arrow-right", 14)}</span><select data-recon-field="destino">${acctOptions(r.sug.destino || "")}</select></div>`
            : `<div class="edit-row"><select data-recon-field="cat">${catList.map((c) => `<option ${c.nome === r.sug.cat ? "selected" : ""}>${c.nome}</option>`).join("")}</select><select data-recon-field="sub">${["", ...subs].map((s) => `<option value="${s}" ${s === (r.sug.sub || "") ? "selected" : ""}>${s || "— sem subcategoria —"}</option>`).join("")}</select></div><select data-recon-field="conta">${acctOptions(r.sug.conta || r.sug.destino)}</select>`}
        </div>`;
    const match = r.match && !isEdit ? `<div class="recon-match${r.matchId != null ? " click" : ""}"${r.matchId != null ? ` data-tx-open="${r.matchId}"` : ""}>${ic("circle-alert", 12)} corresponde a um lançamento existente: <b>${r.match}</b>${r.matchId != null ? ` ${ic("arrow-right", 12)}` : ""}</div>` : "";
    const hint = r.sug.tipo === "transferencia" && !isEdit ? `<div class="recon-hint">não entra como despesa — só move saldo</div>` : "";
    const inst = r.note ? `<div class="recon-inst">${ic("circle-alert", 12)} ${r.note}</div>` : "";
    const actions = isEdit
      ? `<button class="act accept" data-recon-accept="${r.id}">${ic("check", 14)} Salvar</button><button class="act edit" data-recon-edit="${r.id}">${ic("x", 13)} Cancelar</button>`
      : done
        ? `<span class="conc-tag">${ic("check", 14)} Conciliado</span><button class="act edit" data-recon-edit="${r.id}">${ic("pencil", 13)} Editar</button><button class="act skip-btn" data-recon-reactivate="${r.id}" title="Desfazer">${ic("undo", 13)}</button>`
        : skip
          ? `<span class="skip-tag">${r.note ? "Parcela pulada" : "Ignorado"}</span><button class="act edit" data-recon-reactivate="${r.id}">reativar</button>`
          : `<button class="act accept" data-recon-accept="${r.id}">${ic("check", 14)} Aceitar</button><button class="act edit" data-recon-edit="${r.id}">${ic("pencil", 13)} Editar</button><button class="act skip-btn" data-recon-ignore="${r.id}">${ic("x", 13)}</button>`;
    const rawDate = r.iso ? r.iso.split("-").reverse().join("/") : "";
    return `<div class="card recon${done ? " done" : ""}${skip ? " skip" : ""}" data-recon-id="${r.id}"><div class="recon-main"><div class="recon-raw"><div class="raw-label">no extrato${rawDate ? ` · ${rawDate}` : ""}</div><div class="raw-desc">${r.raw}</div><div class="raw-val num" style="color:${r.valor < 0 ? "var(--neg)" : "var(--pos)"}">${fmt(r.valor)}</div></div><div class="recon-arrow">${ic("sparkles", 15)}</div><div class="recon-sug"><div class="raw-label">sugestão · <span style="color:${confCor};font-weight:700">${r.conf}% confiança</span></div>${sug}${inst}${match}${hint}</div></div><div class="recon-actions">${actions}</div></div>`;
  }).join("");
  const addLine = `<button class="recon-add-line" data-recon-add>${ic("plus", 14)} Adicionar lançamento manualmente</button>`;
  return bar + addLine + `<div class="recon-list">${list}</div>`;
}

function catDetailRow(t, hideSub) {
  const sign = t.tipo === "despesa" ? "−" : "+";
  const tcor = t.tipo === "despesa" ? C.despesa : t.tipo === "reembolso" ? C.reembolso : C.receita;
  const meta = `${t.data} · ${t.conta || "—"}${!hideSub && t.sub ? " · " + t.sub : ""}${t.tipo === "reembolso" ? " · reembolso" : ""}`;
  return `<div class="mini-row click txr" data-tx-open="${t.id}"><span class="tx-ic" style="background:${tcor}1A;color:${tcor}">${ic(txCatIcon(t), 16)}</span><div class="tx-mid"><div class="mini-desc">${t.desc}</div><div class="mini-meta">${meta}</div></div><span class="num" style="color:${t.tipo === "despesa" ? "var(--ink)" : "var(--pos)"};font-weight:600">${sign} ${fmtNum(Math.abs(t.valor))}</span></div>`;
}
function openCatDetail(tipo, cat, sub) { state.tab = "categorias"; state.catDetail = { tipo, cat, sub: sub || null }; state.pop = null; renderPop(); renderView(); }
function viewCatDetail() {
  const { tipo, cat, sub } = state.catDetail;
  const node = catTree[tipo].find((c) => c.nome === cat);
  const isRec = tipo === "receita", cor = isRec ? "var(--pos)" : "var(--neg)", accHex = isRec ? C.receita : C.despesa;
  const contrib = (t) => (t.tipo === "reembolso" ? -Math.abs(t.valor) : Math.abs(t.valor));
  const txs = state.tx.filter((t) => {
    if (t.cat !== cat) return false;
    if (sub && (t.sub || "Sem subcategoria") !== sub) return false;
    return tipo === "despesa" ? (t.tipo === "despesa" || t.tipo === "reembolso") : t.tipo === "receita";
  }).sort((a, b) => (b.iso || "").localeCompare(a.iso || ""));
  const total = txs.reduce((s, t) => s + contrib(t), 0);
  const groups = {}; txs.forEach((t) => { const k = (t.iso || "0000-00").slice(0, 7); (groups[k] = groups[k] || []).push(t); });
  const keys = Object.keys(groups).sort((x, y) => y.localeCompare(x));
  const nMonths = keys.filter((k) => k !== "0000-00").length || 1;
  const body = txs.length ? keys.map((k) => {
    const list = groups[k], net = list.reduce((s, t) => s + contrib(t), 0);
    const lbl = k === "0000-00" ? "Sem data" : monthLabel(k + "-01");
    return `<div class="month-div"><span class="md-label">${lbl}</span><span class="md-count">${list.length} ${list.length === 1 ? "lançamento" : "lançamentos"}</span><span class="md-net num" style="color:${cor}">${isRec ? "+" : "−"} ${fmtNum(net)}</span></div>${list.map((t) => catDetailRow(t, !!sub)).join("")}`;
  }).join("") : `<div class="empty-mini">Nenhum lançamento nesta ${sub ? "subcategoria" : "categoria"}.</div>`;
  return `
  <button class="back-btn" data-cat-detail-back>${ic("arrow-left", 16)} Categorias</button>
  <div class="card acct-detail-head"><div class="adh-l"><span class="acct-ic big" style="background:${accHex}1A;color:${accHex}">${ic(catIconOf(node), 22)}</span><div><div class="adh-name">${cat}${sub ? ` · ${sub}` : ""}</div><div class="acct-sub">${isRec ? "ganhos" : "despesas"}${sub ? " · subcategoria" : ""}</div></div></div><div class="adh-saldo num" style="color:${cor}">${fmt(total)}</div></div>
  <div class="adh-stats">
    <div class="card adh-stat"><span>Total</span><b class="num" style="color:${cor}">${fmt(total)}</b></div>
    <div class="card adh-stat"><span>Lançamentos</span><b class="num">${txs.length}</b></div>
    <div class="card adh-stat"><span>Média/mês</span><b class="num">${fmt(total / nMonths)}</b></div>
  </div>
  <div class="detail-actions"><button class="mini-btn" data-cat-detail-edit>${ic("pencil", 14)} ${sub ? "Renomear" : "Renomear / ícone"}</button><button class="mini-btn danger" data-cat-detail-del>${ic("archive", 14)} Excluir</button></div>
  <div class="card table-card" style="padding:6px 18px"><div class="card-head" style="padding:12px 2px 4px"><h3>Lançamentos</h3></div><div class="mini-list">${body}</div></div>`;
}
function viewCategorias() {
  if (state.catDetail) return viewCatDetail();
  const cols = [["receita", "Receitas"], ["despesa", "Despesas"]].map(([tipo, titulo]) => {
    const cor = tipo === "receita" ? C.receita : C.despesa;
    const totals = catTotals(tipo); // total real (todo o histórico) por categoria, das transações
    const tot = (c) => totals[c.nome] || 0;
    const maxT = Math.max(...catTree[tipo].map(tot), 1);
    const nodes = catTree[tipo].map((c) => `<div class="cat-node"><div class="cat-node-head cn-click" data-cat-detail="${tipo}|${c.nome}"><span class="cn-ic">${ic(catIconOf(c), 15)}</span><span class="cn-name">${c.nome}</span><span class="cn-actions"><button class="cn-btn" data-cat-edit="${tipo}|${c.nome}" title="Editar">${ic("pencil", 13)}</button><button class="cn-btn" data-cat-del="${tipo}|${c.nome}" title="Excluir">${ic("archive", 13)}</button></span><span class="cn-total num" style="color:${tot(c) ? cor : "var(--line-strong)"}">${tot(c) ? fmtShort(tot(c)) : "—"}</span></div><div class="cn-bar"><span style="width:${(tot(c) / maxT) * 100}%;background:${cor}"></span></div><div class="cat-subs">${c.subs.map((s) => `<button class="sub-pill" data-cat-detail="${tipo}|${c.nome}|${s}" title="Ver lançamentos">${s}</button>`).join("")}<button class="sub-add" data-add-sub="${tipo}|${c.nome}">${ic("plus", 11)} subcategoria</button></div></div>`).join("");
    return `<div class="card cat-col"><div class="cat-col-head" style="border-color:${cor}33"><span class="cat-dot" style="background:${cor}"></span><h3>${titulo}</h3><span class="cat-count">${catTree[tipo].length} categorias</span></div><div class="cat-tree">${nodes}</div><button class="cat-add" style="color:${cor}" data-add-cat="${tipo}">${ic("plus", 14)} Nova categoria de ${tipo === "receita" ? "receita" : "despesa"}</button></div>`;
  }).join("");
  return `<div class="cat-cols">${cols}</div>`;
}

/* ---------- Histórico de alterações (audit_log) — visão git-like por dia ---------- */
const _esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const _WD = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const _dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
function _dayLabel(k) {
  const [y, m, dd] = k.split("-").map(Number); const d = new Date(y, m - 1, dd);
  const today = _dayKey(new Date()), yest = _dayKey(new Date(Date.now() - 864e5));
  const base = `${_WD[d.getDay()]}, ${String(dd).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  return k === today ? `Hoje · ${base}` : k === yest ? `Ontem · ${base}` : base;
}
const _hhmm = (ts) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
// campos exibíveis no diff (nome técnico → rótulo PT), na ordem que aparecem
const HIST_FIELDS = { descricao: "descrição", valor: "valor", tipo: "tipo", cat: "categoria", sub: "subcategoria", conta: "conta", origem: "origem", destino: "destino", iso: "data", status: "status", nome: "nome", sub_: "sub", saldo: "saldo", parent_id: "categoria-pai", arquivada: "arquivada", ordem: "ordem" };
function _fmtField(f, v) {
  if (v === null || v === undefined || v === "") return "vazio";
  if (f === "valor" || f === "saldo") return fmt(Number(v));
  if (f === "iso") return String(v).split("-").reverse().join("/");
  if (f === "arquivada") return v === true || v === "true" ? "sim" : "não";
  return String(v);
}
function _histDiff(od, nd) {
  const out = [];
  Object.keys(HIST_FIELDS).forEach((f) => {
    const o = od ? od[f] : undefined, n = nd ? nd[f] : undefined;
    if (JSON.stringify(o === undefined ? null : o) !== JSON.stringify(n === undefined ? null : n))
      out.push({ f: HIST_FIELDS[f], o: _fmtField(f, o), n: _fmtField(f, n) });
  });
  return out;
}
const _ACT = { insert: { lb: "criou", cls: "add", ic: "plus" }, update: { lb: "editou", cls: "edit", ic: "pencil" }, delete: { lb: "excluiu", cls: "del", ic: "trash" } };
const _ENT = { transactions: "lançamento", accounts: "conta", categories: "categoria" };
function histEntry(r) {
  if (r.action === "system") {
    return `<div class="hist-entry sys"><span class="he-time num">${_hhmm(r.changed_at)}</span><span class="he-ic">${ic("shield", 13)}</span><div class="he-main"><div class="he-line"><b>Reparo do sistema</b></div><div class="he-sys">${_esc(r.label || "")}</div></div></div>`;
  }
  const a = _ACT[r.action] || { lb: r.action, cls: "", ic: "list" };
  const ent = _ENT[r.tbl] || r.tbl;
  const nd = r.new_data || {}, od = r.old_data || {};
  const valor = r.tbl === "transactions" ? (nd.valor != null ? nd.valor : od.valor) : null;
  const valStr = valor != null && valor !== "" ? `<span class="he-val num">${fmt(Number(valor))}</span>` : "";
  let diff = "";
  if (r.action === "update") {
    const ch = _histDiff(od, nd);
    diff = ch.length ? `<div class="he-diff">${ch.map((c) => `<div class="he-ch"><span class="he-f">${c.f}</span><span class="he-o">${_esc(c.o)}</span>${ic("arrow-right", 11)}<span class="he-n">${_esc(c.n)}</span></div>`).join("")}</div>` : "";
  }
  return `<div class="hist-entry ${a.cls}"><span class="he-time num">${_hhmm(r.changed_at)}</span><span class="he-ic">${ic(a.ic, 13)}</span><div class="he-main"><div class="he-line"><b>${a.lb}</b> <span class="he-ent">${ent}</span> <span class="he-label">${_esc(r.label || "—")}</span> ${valStr}</div>${diff}</div></div>`;
}
function renderHistBody() {
  const a = state.audit;
  if (a === null || a === undefined) return `<div class="hist-loading"><div class="auth-spin"></div><span>Carregando histórico…</span></div>`;
  if (a === "error") return `<div class="card"><div class="empty-mini">Não consegui carregar o histórico. <button class="link" data-hist-refresh>Tentar de novo</button></div></div>`;
  if (!a.length) return `<div class="card hist-empty"><span class="he-empty-ic">${ic("history", 30)}</span><h3>Nenhuma alteração ainda</h3><p>A partir de agora, toda adição, edição ou exclusão de lançamentos, contas e categorias aparece aqui — agrupada por dia.</p></div>`;
  const groups = {};
  a.forEach((r) => { const k = _dayKey(r.changed_at); (groups[k] = groups[k] || []).push(r); });
  const days = Object.keys(groups).sort().reverse();
  if (!state.histOpen) state.histOpen = new Set(days.slice(0, 1)); // só o dia mais recente aberto por padrão
  const body = days.map((k) => {
    const rows = groups[k], n = rows.length, open = state.histOpen.has(k);
    return `<div class="hist-day${open ? " open" : ""}">
      <button class="hist-day-head" data-hist-day="${k}">
        <span class="hd-chev">${ic("chevron-down", 16)}</span>
        <span class="hd-label">${_dayLabel(k)}</span>
        <span class="hd-count">${n} ${n === 1 ? "alteração" : "alterações"}</span>
      </button>
      ${open ? `<div class="hist-list">${rows.map(histEntry).join("")}</div>` : ""}
    </div>`;
  }).join("");
  return `<div class="hist-top"><span class="card-sub">${a.length} ${a.length === 1 ? "alteração registrada" : "alterações registradas"}${a.length >= 300 ? " (últimas 300)" : ""}</span><button class="ghost hist-refresh" data-hist-refresh>${ic("rotate", 14)} Atualizar</button></div>${body}`;
}
async function loadHistorico(force) {
  if (state._auditLoading) return;
  if (state.audit && state.audit !== "error" && !force) return; // já carregado; refresh só com force
  state._auditLoading = true;
  const hasCache = state.audit && state.audit !== "error";
  if (!hasCache) { state.audit = null; const r0 = document.getElementById("hist-root"); if (r0) r0.innerHTML = renderHistBody(); } // spinner só sem cache
  try { state.audit = await Store.fetchAudit(300); }
  catch (e) { if (!hasCache) state.audit = "error"; }
  state._auditLoading = false;
  const r = document.getElementById("hist-root"); if (r) r.innerHTML = renderHistBody();
}
function viewHistorico() {
  loadHistorico();
  return `<div id="hist-root">${renderHistBody()}</div>`;
}

/* ---------- Configurações do usuário ---------- */
function viewConfig() {
  const u = (window.Store && Store.user) || {};
  const meta = u.user_metadata || {};
  const nome = meta.full_name || meta.name || "";
  const email = u.email || "";
  const inicial = ((nome || email || "?").trim()[0] || "?").toUpperCase();
  const nAcc = accounts.filter((a) => !a.arquivada).length;
  const nCat = catTree.receita.length + catTree.despesa.length;
  const nTx = state.tx.length;
  return `<div class="cfg">
    <div class="card cfg-card">
      <div class="cfg-head"><span class="cfg-ic">${ic("user", 17)}</span><h3>Perfil</h3></div>
      <div class="cfg-profile"><span class="cfg-avatar">${inicial}</span>
        <div class="cfg-fields">
          <label class="fld"><span class="fld-label">Nome</span><input data-cfg-name value="${attr(nome)}" placeholder="Seu nome" autocomplete="name"></label>
          <label class="fld"><span class="fld-label">E-mail</span><input value="${attr(email)}" disabled></label>
        </div>
      </div>
      <div class="cfg-actions"><button class="cta" data-config-save-name>Salvar nome</button><span class="cfg-msg" data-cfg-name-msg></span></div>
    </div>
    <div class="card cfg-card">
      <div class="cfg-head"><span class="cfg-ic">${ic("shield", 17)}</span><h3>Segurança</h3></div>
      <p class="cfg-p">Defina ou altere a senha usada para entrar por e-mail + senha.</p>
      <button class="ghost" data-setpass>${ic("key", 15)} Alterar senha</button>
    </div>
    <div class="card cfg-card">
      <div class="cfg-head"><span class="cfg-ic">${ic("download", 17)}</span><h3>Seus dados</h3></div>
      <p class="cfg-p"><b>${nAcc}</b> ${nAcc === 1 ? "conta" : "contas"} · <b>${nCat}</b> categorias · <b>${nTx}</b> ${nTx === 1 ? "lançamento" : "lançamentos"}. Baixe um backup completo em JSON quando quiser.</p>
      <button class="ghost" data-config-export>${ic("download", 15)} Exportar backup (.json)</button>
    </div>
    <div class="card cfg-card">
      <div class="cfg-head"><span class="cfg-ic">${ic("settings", 17)}</span><h3>Aparência</h3></div>
      <p class="cfg-p">O tema acompanha automaticamente o modo claro/escuro do seu sistema.</p>
    </div>
    <div class="card cfg-card danger-zone">
      <div class="cfg-head"><span class="cfg-ic">${ic("log-out", 17)}</span><h3>Sessão</h3></div>
      <p class="cfg-p">Sair desconecta esta conta neste aparelho (seus dados continuam salvos na nuvem).</p>
      <button class="danger" data-signout>${ic("log-out", 15)} Sair da conta</button>
    </div>
    <p class="cfg-ver">Meu Caixa${APP_VERSION ? ` · versão ${APP_VERSION}` : ""}</p>
  </div>`;
}
async function saveConfigName() {
  const inp = document.querySelector("[data-cfg-name]"); const nome = inp ? inp.value.trim() : "";
  const msg = document.querySelector("[data-cfg-name-msg]");
  if (msg) { msg.textContent = "Salvando…"; msg.className = "cfg-msg"; }
  try { const { error } = await Store.updateName(nome); if (error) throw error;
    if (msg) { msg.textContent = "Nome salvo ✓"; msg.className = "cfg-msg ok"; }
    updateSidebarUser();
  } catch (e) { if (msg) { msg.textContent = "Não consegui salvar. Tente de novo."; msg.className = "cfg-msg err"; } }
}
function exportBackup() {
  const data = { app: "MeuCaixa", exportedAt: new Date().toISOString(), user: (window.Store && Store.user && Store.user.email) || null, model: currentModel() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `meucaixa-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const VIEWS = { dashboard: viewDashboard, patrimonial: viewPatrimonial, contas: viewContas, transacoes: viewTransacoes, conciliacao: viewConciliacao, categorias: viewCategorias, historico: viewHistorico, config: viewConfig };

/* ---------- drill-down do gráfico Receitas × Despesas ---------- */
function renderDrill() {
  const el = document.getElementById("drill-root");
  if (!state.drill) { el.innerHTML = ""; return; }
  const d = state.drill;
  let title = "", back = "", body = "";
  if (d.stage === "months") {
    title = "Escolha um mês";
    body = `<div class="drill-months">${allMonthsSummary().map((m) => `<button class="drill-month" data-drill-month="${m.ym}"><span class="dm-mes">${m.label}</span><span class="dm-vals"><b style="color:${C.receita}">+ ${fmtShort(m.receita)}</b><b style="color:${C.despesa}">− ${fmtShort(m.despesa)}</b></span><span class="dm-net num">${fmt(m.receita - m.despesa)}</span>${ic("arrow-right", 15)}</button>`).join("")}</div>`;
  } else if (d.stage === "split") {
    const lbl = monthLabel(d.month + "-01");
    const receita = byCat("receita", d.month).reduce((s, x) => s + x.valor, 0);
    const despesa = byCat("despesa", d.month).reduce((s, x) => s + x.valor, 0);
    title = `${lbl} — receitas × despesas`;
    back = `<button class="drill-back" data-drill-back="months">${ic("arrow-left", 15)} meses</button>`;
    const data = [{ nome: "Receitas", valor: receita }, { nome: "Despesas", valor: despesa }];
    body = `<div class="drill-pie"><div class="pie-box">${donutSVG(data, [C.receita, C.despesa])}<div class="donut-center"><span>saldo</span><strong class="num">${fmtShort(receita - despesa)}</strong></div></div><ul class="cat-legend"><li><i style="background:${C.receita}"></i><span>Receitas</span><b class="num">${fmtShort(receita)}</b></li><li><i style="background:${C.despesa}"></i><span>Despesas</span><b class="num">${fmtShort(despesa)}</b></li></ul></div><div class="drill-ask"><p>Quer afunilar em quê?</p><div class="drill-ask-btns"><button class="ask-btn" style="--c:${C.receita}" data-drill-type="receita">${ic("trending-up", 15)} Ver receitas</button><button class="ask-btn" style="--c:${C.despesa}" data-drill-type="despesa">${ic("trending-down", 15)} Ver despesas</button></div></div>`;
  } else {
    const lbl = monthLabel(d.month + "-01");
    const cats = drillCats(d.month, d.type);
    const total = cats.reduce((s, c) => s + c.valor, 0);
    title = `${lbl} — ${d.type === "receita" ? "receitas" : "despesas"} por categoria`;
    back = `<button class="drill-back" data-drill-back="split">${ic("arrow-left", 15)} ${lbl}</button>`;
    body = `<div class="drill-pie"><div class="pie-box">${donutSVG(cats)}<div class="donut-center"><span>total</span><strong class="num">${fmtShort(total)}</strong></div></div><ul class="cat-legend">${cats.map((c, i) => `<li><i style="background:${donutPalette[i % donutPalette.length]}"></i><span>${c.nome}</span><b class="num">${fmtShort(c.valor)}</b></li>`).join("")}</ul></div>`;
  }
  el.innerHTML = `<div class="overlay" id="drill-overlay"><div class="modal drill-modal"><div class="modal-head"><div class="drill-head-l">${back}<h3>${title}</h3></div><button class="x" data-drill-close>${ic("x", 18)}</button></div><div class="drill-body">${body}</div></div></div>`;
}

/* ---------- 7. modal ---------- */
function modalHTML() {
  const baseTipo = state.modalTipo;                                   // despesa | receita | transferencia
  const isReemb = baseTipo === "receita" && !!state.form.reembolso;
  const tipo = isReemb ? "reembolso" : baseTipo;                      // tipo efetivo (com reembolso)
  const t = TIPOS[tipo];
  const catList = tipo === "receita" ? catTree.receita : catTree.despesa;
  const showCat = tipo !== "transferencia";
  const f = state.form;

  // segmentado de tipo (3, pílula) — reembolso vira slider dentro de Receita
  const seg = ["despesa", "receita", "transferencia"].map((k) => {
    const v = TIPOS[k];
    const on = baseTipo === k;
    return `<button class="seg ${on ? "on" : ""}" data-modal-tipo="${k}" ${on ? `style="color:${v.cor}"` : ""}>${v.label}</button>`;
  }).join("");

  // slider "é um reembolso" — só aparece em Receita
  const reembToggle = baseTipo === "receita"
    ? `<div class="reemb-row"><button class="switch ${isReemb ? "on" : ""}" data-modal-reemb aria-pressed="${isReemb}" style="--acc:${TIPOS.reembolso.cor}"><span class="knob"></span></button><div class="reemb-txt"><b>É um reembolso</b><span>Crédito que volta pra uma despesa — não é receita nova</span></div></div>`
    : "";

  // grade de categorias (ícone) + subcategorias
  let catBlock = "";
  if (showCat) {
    const tiles = catList.map((c) =>
      `<button class="cat-tile ${f.cat === c.nome ? "on" : ""}" data-modal-cat="${c.nome}">${ic(catIconOf(c), 20)}<span>${c.nome}</span></button>`
    ).join("");
    const selObj = catList.find((c) => c.nome === f.cat);
    const subs = selObj ? `<div class="sub-wrap"><div class="fld-label">Subcategoria</div><div class="sub-row">${selObj.subs.map((s) => `<button class="sub-pick ${f.sub === s ? "on" : ""}" data-modal-sub="${s}">${s}</button>`).join("")}</div></div>` : "";
    const lbl = `Categoria${tipo === "reembolso" ? ' <span class="lbl-hint">· de qual despesa voltou</span>' : ""}`;
    catBlock = `<div class="cat-pick-wrap"><div class="fld-label">${lbl}</div><div class="cat-grid">${tiles}</div>${subs}</div>`;
  } else {
    catBlock = `<div class="cat-pick-wrap"><div class="transfer-fields"><label class="fld"><span class="fld-label">De</span><select data-field="origem">${acctOptions(f.origem)}</select></label><span class="tf-arrow">${ic("arrow-right", 18)}</span><label class="fld"><span class="fld-label">Para</span><select data-field="destino">${acctOptions(f.destino)}</select></label></div></div>`;
  }

  const contaField = showCat
    ? `<label class="fld"><span class="fld-label">${tipo === "despesa" ? "Conta de origem" : "Conta destino"}</span><select data-field="conta">${acctOptions(f.conta)}</select></label>`
    : "";

  const note = { receita: "Entra como receita e soma no resultado do mês.", despesa: "Sai como despesa e reduz o resultado do mês.", transferencia: "Move saldo entre contas. Não conta como receita nem despesa.", reembolso: "Reduz a despesa da categoria escolhida — dinheiro que voltou." }[tipo];
  const canSave = parseValor(f.valor) > 0 && (baseTipo === "transferencia" || !!f.cat);

  const editing = !!state.editTx;
  const recon = !!state.modalRecon;
  return `<div class="overlay" id="overlay"><div class="modal modal-tx" style="--acc:${t.cor}">
    <div class="modal-head"><h3>${editing ? "Editar lançamento" : recon ? "Adicionar à conciliação" : "Nova transação"}</h3><button class="x" data-action="close-modal">${ic("x", 18)}</button></div>
    <div class="tx-body">
      <div class="type-seg3">${seg}</div>
      ${reembToggle}
      <div class="amount-block"><label class="amount-inline"><span class="amt-cur">R$</span><input class="amt-input" data-field="valor" value="${f.valor || ""}" placeholder="0,00" inputmode="decimal" autocomplete="off"></label></div>
      ${catBlock}
      <div class="form2">
        <label class="fld"><span class="fld-label">Descrição</span><input data-field="desc" value="${attr(f.desc)}" placeholder="Ex.: Mercado, cliente X, aporte…"></label>
        <div class="fld-row">${contaField}<label class="fld"><span class="fld-label">Data</span><div class="date-wrap">${ic("calendar", 16)}<input type="date" data-field="data" value="${f.data || TODAY_ISO}"></div><div class="date-quick"><button class="date-chip ${(f.data || TODAY_ISO) === TODAY_ISO ? "on" : ""}" data-date-set="0" type="button">Hoje</button><button class="date-chip ${f.data === isoPlusDays(TODAY_ISO, -1) ? "on" : ""}" data-date-set="-1" type="button">Ontem</button></div></label></div>
      </div>
      <div class="tx-note" style="background:${t.cor}12;color:${t.cor}"><span class="tx-note-ic">${ic("circle-alert", 14)}</span><span>${note}</span></div>
    </div>
    <div class="modal-foot-tx">
      <button class="save-tx" data-action="save-tx" style="background:${t.cor}" ${canSave ? "" : "disabled"}>${ic("check", 16)} ${editing ? "Salvar alterações" : recon ? "Adicionar à conciliação" : `Salvar ${t.label.toLowerCase()}`}</button>
    </div>
  </div></div>`;
}

/* ---------- 8. estado, render e eventos ---------- */
const state = {
  tab: "dashboard",
  prefs: {}, // preferências sincronizadas (metas de alocação, snapshots de patrimônio, premissas IPCA/CDI)
  tx: initialTx.slice(),
  recon: [],
  imported: false, reconAccount: null, reconFiles: [], reconDone: null, modalRecon: false,
  reconBank: "", // saldo real digitado do app do banco (batimento contra o projetado)
  filter: "todas",
  modal: false,
  modalTipo: "despesa",
  editing: null,
  form: { desc: "", valor: "", cat: "", sub: "", conta: "Conta Corrente", data: TODAY_ISO, origem: "Conta Corrente", destino: "Investimentos" },
  // contas
  acctDetail: null, acctMenu: null, acctEdit: null,
  // detalhe de categoria/subcategoria (todos os lançamentos)
  catDetail: null,
  // dashboard
  dashEdit: false, dashOrder: ["receitaDespesa", "categorias", "ganhos", "patrimonio", "ultimas"], dragKey: null,
  // drill-down + pop-ups
  drill: null, pop: null, editTx: null,
  // donuts de categoria (despesas e ganhos), cada um com mês/seleção/drill próprios
  donut: { despesa: { month: null, active: null, drill: null }, receita: { month: null, active: null, drill: null } },
  // gráfico de patrimônio (período + seleção por arrasto)
  pcRange: null, pcSel: null,
};
let pcDrag = null;
const freshForm = () => {
  const ativas = accounts.filter((a) => !a.arquivada);
  const c0 = ativas[0] ? ativas[0].nome : "Conta Corrente", c1 = ativas[1] ? ativas[1].nome : c0;
  return { desc: "", valor: "", cat: "", sub: "", conta: c0, data: TODAY_ISO, origem: c0, destino: c1, reembolso: false };
};
// opções de conta: só as ativas + a atual (mesmo arquivada) pra não perder a seleção ao editar
function acctOptions(selected) {
  return accounts.filter((a) => !a.arquivada || a.nome === selected).map((a) => `<option ${a.nome === selected ? "selected" : ""}>${a.nome}</option>`).join("");
}

let elView, elTitle, elSub, elBadge, elModal;

/* ---------- persistência local (edições sobrevivem ao reload) ---------- */
/* modelo em memória ⇄ snapshot persistido (IndexedDB) + sync (Supabase), tudo via window.Store */
const cloneCat = (c) => Object.assign({}, c, { subs: (c.subs || []).slice() });
function currentModel() {
  return {
    accounts: accounts.map((a) => Object.assign({}, a)),
    catTree: { receita: catTree.receita.map(cloneCat), despesa: catTree.despesa.map(cloneCat) },
    tx: state.tx.slice(), dashOrder: state.dashOrder.slice(), prefs: Object.assign({}, state.prefs),
    assetMoves: assetMoves.map((m) => Object.assign({}, m)),
  };
}
function applyModel(m) {
  if (!m) return;
  if (Array.isArray(m.accounts)) { accounts.length = 0; m.accounts.forEach((a) => accounts.push(a)); }
  if (m.catTree) { ["receita", "despesa"].forEach((k) => { if (Array.isArray(m.catTree[k])) { catTree[k].length = 0; m.catTree[k].forEach((c) => catTree[k].push(c)); } }); }
  if (Array.isArray(m.tx)) { state.tx = m.tx; sortTx(); }
  if (Array.isArray(m.assetMoves)) { assetMoves.length = 0; m.assetMoves.forEach((x) => assetMoves.push(x)); }
  if (m.prefs && typeof m.prefs === "object") state.prefs = m.prefs;
  if (Array.isArray(m.dashOrder) && m.dashOrder.length) state.dashOrder = m.dashOrder;
}
// as linhas voltam do banco na ordem de `updated_at` (empates = ordem física da tabela), então sem
// ordenar aqui a aba Transações e o bloco "Últimas transações" mostravam lançamentos arbitrários —
// e o rodapé ainda dizia "os 300 mais recentes". Data desc; sem data vai pro fim.
function sortTx() { state.tx.sort((a, b) => (b.iso || "").localeCompare(a.iso || "")); }
let _saveT = null;
function saveState() { if (window.Store && Store.isAuthed()) Store.saveSnapshot(currentModel()); }
function scheduleSave() { clearTimeout(_saveT); _saveT = setTimeout(saveState, 400); }

function renderView() {
  document.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === state.tab));
  const meta = PAGE[state.tab];
  if (elTitle) elTitle.textContent = meta[0];
  if (elSub) elSub.textContent = meta[1];
  const pend = state.recon.filter((r) => r.status === "pendente").length;
  if (elBadge) { elBadge.textContent = pend; elBadge.style.display = pend ? "grid" : "none"; }
  elView.innerHTML = VIEWS[state.tab]();
  scheduleSave();
}
function renderModal() {
  elModal.innerHTML = state.modal ? modalHTML() : "";
}

/* handlers */
function openModal() { state.modal = true; state.modalRecon = false; state.editTx = null; state.modalTipo = "despesa"; state.form = freshForm(); state.acctMenu = null; renderModal(); }
function openEditTx(id) {
  const t = state.tx.find((x) => String(x.id) === String(id)); if (!t) return;
  state.editTx = t.id;
  state.modalTipo = t.tipo === "reembolso" ? "receita" : t.tipo;
  state.form = {
    desc: t.desc || "", valor: fmtNum(Math.abs(t.valor)),
    cat: t.cat || "", sub: t.sub || "", conta: t.conta || "Conta Corrente",
    data: t.iso || TODAY_ISO, origem: t.origem || "Conta Corrente", destino: t.destino || "Investimentos",
    reembolso: t.tipo === "reembolso",
  };
  state.pop = null; state.modal = true; state.modalRecon = false;
  renderPop(); renderModal();
}
function closeModal() { state.modal = false; state.modalRecon = false; state.editTx = null; renderModal(); }
function setTipo(k) { state.modalTipo = k; state.form.cat = ""; state.form.sub = ""; state.form.reembolso = false; renderModal(); }
function toggleReemb() { state.form.reembolso = !state.form.reembolso; state.form.cat = ""; state.form.sub = ""; renderModal(); }
function pickCat(nome) {
  const list = state.modalTipo === "receita" ? catTree.receita : catTree.despesa;
  const obj = list.find((c) => c.nome === nome);
  state.form.cat = nome; state.form.sub = obj ? obj.subs[0] : "";
  renderModal();
}
function pickSub(s) { state.form.sub = s; renderModal(); }
function updateSaveEnabled() {
  const btn = document.querySelector(".save-tx");
  if (!btn) return;
  const ok = parseValor(state.form.valor) > 0 && (state.modalTipo === "transferencia" || !!state.form.cat);
  btn.disabled = !ok;
}
function saveTx() {
  const v = parseValor(state.form.valor);
  const tipo = state.modalTipo === "receita" && state.form.reembolso ? "reembolso" : state.modalTipo;
  if (v <= 0) return;
  if (tipo !== "transferencia" && !state.form.cat) return;
  if (state.modalRecon) {
    state.recon = [formToRecon(), ...state.recon];
    state.modalRecon = false; state.modal = false; state.editTx = null;
    renderModal(); renderView();
    return;
  }
  const iso = state.form.data || TODAY_ISO;
  const orig = state.editTx ? state.tx.find((t) => t.id === state.editTx) : null;
  const base = { id: state.editTx || Date.now(), data: dataBR(iso), iso, desc: state.form.desc || TIPOS[tipo].label, tipo, status: orig ? orig.status : "pendente" };
  let tx;
  if (tipo === "transferencia") {
    tx = { ...base, origem: state.form.origem || "Conta Corrente", destino: state.form.destino || "Investimentos", valor: v };
  } else {
    const list = tipo === "receita" ? catTree.receita : catTree.despesa;
    const catObj = list.find((c) => c.nome === state.form.cat) || list[0];
    tx = { ...base, cat: catObj.nome, sub: state.form.sub || catObj.subs[0], conta: state.form.conta || "Conta Corrente", valor: tipo === "despesa" ? -Math.abs(v) : Math.abs(v) };
  }
  if (orig) applyTxToBalance(orig, -1); // reverte o efeito antigo (edição)
  applyTxToBalance(tx, 1);              // aplica o efeito novo no saldo das contas
  state.tx = state.editTx ? state.tx.map((t) => (t.id === state.editTx ? tx : t)) : [tx, ...state.tx];
  sortTx();
  state.editTx = null;
  state.modal = false;
  refreshSideNet();
  renderModal();
  renderView();
}
/* contas */
function refreshSideNet() { const el = document.getElementById("side-net-val"); if (el) el.textContent = fmt(netWorth()); }
function openAcct(nome) {
  state.tab = "contas"; state.acctDetail = nome; state.acctMenu = null; renderView();
  const a = acctByName(nome); // carteira: busca cotações ao abrir (se ainda não tem)
  if (a && a.tipo === "invest" && hasHoldings() && !quotesTs) fetchQuotes().then((ok) => { if (ok) { refreshSideNet(); renderView(); } });
}
function backAcct() { state.acctDetail = null; renderView(); }
function toggleAcctMenu(id) { state.acctMenu = state.acctMenu === id ? null : id; renderView(); }
function startEditAcct(id) { const a = acctById(id); if (!a) return; state.acctMenu = null; state.pop = { kind: "acctEdit", id, curName: a.nome, editIcon: acctIconOf(a) }; renderPop(); }
function cancelEditAcct() { state.acctEdit = null; renderView(); }
function saveAcctEditForm(id) {
  const a = acctById(id), inp = document.querySelector('[data-ae="nome"]');
  if (a) {
    a.icon = state.pop.editIcon;
    const nv = inp ? inp.value.trim() : "";
    if (nv && nv !== a.nome) { const old = a.nome; a.nome = nv; state.tx.forEach((t) => { if (t.conta === old) t.conta = nv; if (t.origem === old) t.origem = nv; if (t.destino === old) t.destino = nv; }); if (state.acctDetail === old) state.acctDetail = nv; }
  }
  closePop(); renderView();
}
function saveAcctName(id) {
  const inp = document.querySelector(`[data-acct-input="${id}"]`), a = acctById(id);
  if (a && inp) {
    const nv = inp.value.trim();
    if (nv && nv !== a.nome) {
      const old = a.nome; a.nome = nv;
      state.tx.forEach((t) => { if (t.conta === old) t.conta = nv; if (t.origem === old) t.origem = nv; if (t.destino === old) t.destino = nv; });
      if (state.acctDetail === old) state.acctDetail = nv;
    }
  }
  state.acctEdit = null; renderView();
}
function moveAcct(id, dir) {
  const a = acctById(id); if (!a) return;
  const group = accounts.filter((x) => x.grupo === a.grupo && !x.arquivada);
  const pos = group.indexOf(a), swap = dir === "up" ? group[pos - 1] : group[pos + 1];
  if (!swap) return;
  const i = accounts.indexOf(a), j = accounts.indexOf(swap);
  accounts[i] = swap; accounts[j] = a;
  reindexAccounts();
  renderView();
}
// `ordem` é o que o banco guarda (rowsToModel ordena por ele). Mexer só na posição do array não
// persistia nada: no reload a ordem antiga voltava. Reindexa sempre que a lista muda.
function reindexAccounts() { accounts.forEach((a, i) => { a.ordem = i; }); }
function toggleArchive(id) { const a = acctById(id); if (a) a.arquivada = !a.arquivada; state.acctMenu = null; refreshSideNet(); renderView(); }
/* dashboard */
function moveDash(key, dir) {
  const o = state.dashOrder, i = o.indexOf(key), j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= o.length) return;
  [o[i], o[j]] = [o[j], o[i]]; renderView();
}
function reorderDash(fromKey, toKey) {
  if (!fromKey || fromKey === toKey) return;
  const o = state.dashOrder;
  o.splice(o.indexOf(fromKey), 1);
  o.splice(o.indexOf(toKey), 0, fromKey);
  renderView();
}
/* drill-down */
function openDrill() { state.drill = { stage: "months" }; renderDrill(); }
function closeDrill() { state.drill = null; renderDrill(); }
function drillMonth(mes) { state.drill = { stage: "split", month: mes }; renderDrill(); }
function drillType(tipo) { state.drill = { ...state.drill, stage: "cats", type: tipo }; renderDrill(); }
function drillBack(to) {
  if (to === "months") state.drill = { stage: "months" };
  else if (to === "split") state.drill = { stage: "split", month: state.drill.month };
  renderDrill();
}

/* ---------- pop-ups (lançamento, nova conta, nova categoria) ---------- */
function renderPop() {
  const el = document.getElementById("pop-root");
  if (!el) return;
  if (!state.pop) { el.innerHTML = ""; return; }
  const p = state.pop;
  let title = "", body = "", foot = "";
  if (p.kind === "tx") {
    const t = state.tx.find((x) => String(x.id) === String(p.id));
    if (!t) { state.pop = null; el.innerHTML = ""; return; }
    title = "Lançamento";
    const linha = (k, v) => `<div class="pop-line"><span>${k}</span><span>${v}</span></div>`;
    body = `<div class="pop-tx-top">${badgeHTML(t.tipo)}<div class="pop-tx-val">${moneyHTML(t.tipo, t.valor, true)}</div></div>
      ${linha("Descrição", t.desc || "—")}
      ${t.tipo === "transferencia" ? linha("De → Para", `${t.origem} → ${t.destino}`) : linha("Categoria", `${t.cat}${t.sub ? " · " + t.sub : ""}`)}
      ${t.tipo !== "transferencia" ? linha("Conta", t.conta || "—") : ""}
      ${linha("Data", t.iso ? t.iso.split("-").reverse().join("/") : t.data)}
      ${linha("Status", t.status)}`;
    foot = `<button class="pop-danger" data-tx-del="${t.id}">${ic("archive", 15)} Excluir</button><button class="mini-btn primary" data-tx-edit="${t.id}">${ic("pencil", 15)} Editar</button>`;
  } else if (p.kind === "acctForm") {
    title = "Nova conta";
    body = `<label class="fld"><span class="fld-label">Nome</span><input data-af="nome" placeholder="Ex.: Conta corrente" autocomplete="off"></label>
      <div class="fld-row"><label class="fld"><span class="fld-label">Tipo</span><select data-af="tipo"><option value="banco">Conta / banco</option><option value="invest">Investimento</option><option value="cartao">Cartão de crédito</option><option value="dinheiro">Dinheiro</option><option value="patrimonio">Patrimônio (bem)</option></select></label><label class="fld"><span class="fld-label">Saldo inicial</span><input data-af="saldo" inputmode="decimal" placeholder="0,00" autocomplete="off"></label></div>`;
    foot = `<button class="mini-btn primary" data-acct-form-save>Adicionar conta</button><button class="mini-btn" data-pop-close>Cancelar</button>`;
  } else if (p.kind === "catForm") {
    title = p.parent ? "Nova subcategoria" : `Nova categoria de ${p.tipo === "receita" ? "receita" : "despesa"}`;
    body = `${p.parent ? `<p class="pop-hint">Dentro de <b>${p.parent}</b></p>` : ""}<label class="fld"><span class="fld-label">Nome</span><input data-cf="nome" placeholder="${p.parent ? "Ex.: Mercado" : "Ex.: Educação"}" autocomplete="off"></label>`;
    foot = `<button class="mini-btn primary" data-cat-form-save>Adicionar</button><button class="mini-btn" data-pop-close>Cancelar</button>`;
  } else if (p.kind === "catTx") {
    const tipo = p.tipo || "despesa", isDesp = tipo === "despesa", cor = isDesp ? "var(--neg)" : "var(--pos)";
    // despesa inclui os reembolsos da categoria (abatem o total, como no byCat/viewCatDetail)
    const list = state.tx.filter((t) => (isDesp ? (t.tipo === "despesa" || t.tipo === "reembolso") : t.tipo === "receita") && t.cat === p.cat && (!p.sub || (t.sub || "Sem subcategoria") === p.sub) && (t.iso || "").slice(0, 7) === p.ym).sort((a, b) => (b.iso || "").localeCompare(a.iso || ""));
    const contrib = (t) => (t.tipo === "reembolso" ? -Math.abs(t.valor) : Math.abs(t.valor));
    const total = list.reduce((s, t) => s + contrib(t), 0);
    title = p.sub ? `${p.cat} · ${p.sub}` : p.cat;
    body = `<div class="pop-cat-head"><span>${ymLabel(p.ym)} · ${list.length} ${list.length === 1 ? "lançamento" : "lançamentos"}</span><b class="num" style="color:${cor}">${fmt(total)}</b></div>
      <div class="pop-cat-list">${list.map((t) => { const reemb = t.tipo === "reembolso"; const rc = reemb ? "var(--pos)" : cor; const rs = reemb ? "+" : (isDesp ? "−" : "+"); return `<div class="mini-row click" data-tx-open="${t.id}"><div class="mini-l"><div><div class="mini-desc">${t.desc}</div><div class="mini-meta">${t.data}${t.sub ? " · " + t.sub : ""}${t.conta ? " · " + t.conta : ""}${reemb ? " · reembolso" : ""}</div></div></div><span class="num" style="color:${rc};font-weight:600">${rs} ${fmtNum(Math.abs(t.valor))}</span></div>`; }).join("") || `<div class="empty-mini">Sem lançamentos.</div>`}</div>`;
    foot = `<button class="mini-btn" data-cat-detail="${tipo}|${p.cat}${p.sub ? "|" + p.sub : ""}">${ic("list", 14)} Ver todos os meses</button>`;
  } else if (p.kind === "catEdit") {
    title = "Editar categoria";
    body = `<label class="fld"><span class="fld-label">Nome</span><input data-ce="nome" value="${attr(p.curName != null ? p.curName : p.nome)}" autocomplete="off"></label>
      <div class="fld"><span class="fld-label">Ícone</span>${iconPicker("data-ce-icon", p.editIcon)}</div>`;
    foot = `<button class="pop-danger" data-cat-del="${p.tipo}|${p.nome}">${ic("archive", 15)} Excluir</button><button class="mini-btn primary" data-cat-rename-save>Salvar</button>`;
  } else if (p.kind === "catDelete") {
    const others = catTree[p.tipo].filter((c) => c.nome !== p.nome);
    title = "Excluir categoria";
    body = others.length
      ? `<p class="pop-hint">Todos os lançamentos de <b>${p.nome}</b> serão transferidos para outra categoria (transbordo).</p><label class="fld"><span class="fld-label">Transferir tudo para</span><select data-cd="target">${others.map((c) => `<option>${c.nome}</option>`).join("")}</select></label>`
      : `<p class="pop-hint">Crie outra categoria de ${p.tipo} antes — os lançamentos precisam de um destino.</p>`;
    foot = others.length
      ? `<button class="mini-btn" data-pop-close>Cancelar</button><button class="pop-danger" data-cat-del-confirm="${p.tipo}|${p.nome}">Excluir e transferir</button>`
      : `<button class="mini-btn" data-pop-close>Entendi</button>`;
  } else if (p.kind === "subEdit") {
    title = "Editar subcategoria";
    const seOpts = catTree[p.tipo].map((c) => `<option${c.nome === p.parent ? " selected" : ""}>${c.nome}</option>`).join("");
    body = `<label class="fld"><span class="fld-label">Nome</span><input data-se="nome" value="${attr(p.sub)}" autocomplete="off"></label><label class="fld"><span class="fld-label">Categoria</span><select data-se="parent">${seOpts}</select></label>`;
    foot = `<button class="pop-danger" data-sub-del-ask="${p.tipo}|${p.parent}|${p.sub}">${ic("archive", 15)} Excluir</button><button class="mini-btn primary" data-sub-rename-save>Salvar</button>`;
  } else if (p.kind === "subDelete") {
    const node = catTree[p.tipo].find((c) => c.nome === p.parent);
    const others = node ? node.subs.filter((s) => s !== p.sub) : [];
    title = "Excluir subcategoria";
    body = `<p class="pop-hint">Os lançamentos de <b>${p.sub}</b> (em ${p.parent}) vão para:</p><label class="fld"><span class="fld-label">Transferir para</span><select data-sd="target"><option value="">Sem subcategoria</option>${others.map((s) => `<option>${s}</option>`).join("")}</select></label>`;
    foot = `<button class="mini-btn" data-pop-close>Cancelar</button><button class="pop-danger" data-sub-del-confirm="${p.tipo}|${p.parent}|${p.sub}">Excluir e transferir</button>`;
  } else if (p.kind === "acctEdit") {
    const a = acctById(p.id);
    title = "Editar conta";
    body = `<label class="fld"><span class="fld-label">Nome</span><input data-ae="nome" value="${attr(p.curName != null ? p.curName : (a ? a.nome : ""))}" autocomplete="off"></label>
      <div class="fld"><span class="fld-label">Ícone</span>${iconPicker("data-ae-icon", p.editIcon)}</div>`;
    foot = `<button class="mini-btn" data-pop-close>Cancelar</button><button class="mini-btn primary" data-acct-edit-save="${p.id}">Salvar</button>`;
  } else if (p.kind === "assetMove") {
    const carteiras = accounts.filter((a) => !a.arquivada && a.tipo === "invest");
    const contaOpts = carteiras.map((a) => `<option value="${attr(a.id)}"${a.id === p.contaId ? " selected" : ""}>${_esc(a.nome)}</option>`).join("");
    const classeOpts = Object.keys(CLASSE_LABEL).map((k) => `<option value="${k}"${k === (p.classe || "acao") ? " selected" : ""}>${CLASSE_LABEL[k]}</option>`).join("");
    title = p.id ? "Editar ativo" : "Lançar ativo";
    body = `<div class="am-tipo">
        <button type="button" class="am-tab ${(p.tipo || "compra") === "compra" ? "on" : ""}" data-am-tipo="compra">Compra</button>
        <button type="button" class="am-tab ${p.tipo === "venda" ? "on" : ""}" data-am-tipo="venda">Venda</button>
      </div>
      <div class="fld-row"><label class="fld"><span class="fld-label">Carteira</span><select data-am="conta">${contaOpts}</select></label><label class="fld"><span class="fld-label">Data</span><input type="date" data-am="data" value="${attr(p.data || TODAY_ISO)}"></label></div>
      <div class="fld-row"><label class="fld"><span class="fld-label">Ticker</span><input data-am="ticker" placeholder="Ex.: HGLG11" autocomplete="off" style="text-transform:uppercase" value="${attr(p.ticker || "")}"></label><label class="fld"><span class="fld-label">Classe</span><select data-am="classe">${classeOpts}</select></label></div>
      <label class="fld"><span class="fld-label">Nome (opcional)</span><input data-am="nome" placeholder="Ex.: CSHG Logística" autocomplete="off" value="${attr(p.nome || "")}"></label>
      <div class="fld-row"><label class="fld"><span class="fld-label">Quantidade</span><input data-am="qtd" inputmode="decimal" placeholder="0" autocomplete="off" value="${attr(p.qtd || "")}"></label><label class="fld"><span class="fld-label">Preço unitário</span><input data-am="preco" inputmode="decimal" placeholder="0,00" autocomplete="off" value="${attr(p.preco || "")}"></label></div>
      <p class="pop-hint">O preço médio é calculado pelo sistema a partir dos seus lançamentos.</p>`;
    foot = p.id
      ? `<button class="pop-danger" data-inv-del="${attr(p.id)}">${ic("archive", 15)} Excluir</button><button class="mini-btn primary" data-inv-save>Salvar</button>`
      : `<button class="mini-btn" data-pop-close>Cancelar</button><button class="mini-btn primary" data-inv-save>Salvar lançamento</button>`;
  } else if (p.kind === "assetMoves") {
    const a = acctById(p.contaId);
    title = a ? a.nome : "Lançamentos";
    const moves = assetMoves.filter((m) => m.contaId === p.contaId).slice().sort((x, y) => String(y.iso || "").localeCompare(String(x.iso || "")));
    body = `<div class="pop-cat-list">${moves.map((m) => {
      const venda = m.tipo === "venda", cor = venda ? "var(--neg)" : "var(--pos)";
      const total = numOr0(m.qtd) * numOr0(m.preco);
      return `<div class="mini-row"><div class="mini-l"><div><div class="mini-desc">${venda ? "Venda" : "Compra"} · ${_esc(m.ticker || "?")}</div><div class="mini-meta">${m.iso ? dataBR(m.iso) : "—"} · ${(Math.round(numOr0(m.qtd) * 1e6) / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 6 })} × ${fmtNum(m.preco)}</div></div></div><div class="inv-move-r"><span class="num" style="color:${cor};font-weight:600">${fmtNum(total)}</span><button class="pop-danger sm" data-inv-del="${attr(m.id)}" title="Excluir">${ic("archive", 14)}</button></div></div>`;
    }).join("") || `<div class="empty-mini">Sem lançamentos.</div>`}</div>`;
    foot = `<button class="mini-btn primary" data-inv-add="${attr(p.contaId)}">${ic("plus", 14)} Novo lançamento</button>`;
  } else if (p.kind === "abertura") {
    const a = acctByName(p.nome), cart = temAtivos(a);
    title = cart ? "Caixa inicial" : "Saldo inicial";
    body = `<p class="pop-hint">Valor da conta <b>antes do primeiro lançamento</b>. Ajuste se o histórico importado estiver incompleto — assim a reconstrução para de mostrar mês com saldo negativo. Mudar isso re-baseia o saldo atual (sobe/desce tudo junto).</p>
      <label class="fld"><span class="fld-label">${cart ? "Caixa inicial" : "Saldo inicial"}</span><input data-abertura-inp inputmode="decimal" value="${attr(p.cur != null ? p.cur : "")}" autocomplete="off"></label>`;
    foot = `<button class="mini-btn" data-pop-close>Cancelar</button><button class="mini-btn primary" data-abertura-save="${attr(p.nome)}">Salvar</button>`;
  } else if (p.kind === "metas") {
    const m = patMetas();
    title = "Metas de alocação";
    body = `<p class="pop-hint">Percentual-alvo de cada classe sobre o patrimônio bruto. Não precisa somar 100%.</p>
      ${PAT_CLASSES.map((c) => `<label class="fld fld-inline"><span class="fld-label"><span class="pat-dot" style="background:${c.cor}"></span>${c.label}</span><input data-meta="${c.key}" inputmode="decimal" placeholder="0" autocomplete="off" value="${attr(m[c.key] != null ? m[c.key] : "")}"><span class="fld-suffix">%</span></label>`).join("")}`;
    foot = `<button class="mini-btn" data-pop-close>Cancelar</button><button class="mini-btn primary" data-metas-save>Salvar metas</button>`;
  } else if (p.kind === "premissas") {
    const pr = patPrem();
    title = "Premissas (IPCA / CDI)";
    body = `<p class="pop-hint">Índices acumulados nos últimos 12 meses (%). Usados pra calcular retorno real e excesso sobre o CDI.</p>
      <div class="fld-row"><label class="fld"><span class="fld-label">IPCA 12m</span><input data-prem="ipca" inputmode="decimal" placeholder="0,0" autocomplete="off" value="${attr(pr.ipca != null ? pr.ipca : "")}"></label><label class="fld"><span class="fld-label">CDI 12m</span><input data-prem="cdi" inputmode="decimal" placeholder="0,0" autocomplete="off" value="${attr(pr.cdi != null ? pr.cdi : "")}"></label></div>`;
    foot = `<button class="mini-btn" data-pop-close>Cancelar</button><button class="mini-btn primary" data-prem-save>Salvar</button>`;
  }
  el.innerHTML = `<div class="overlay" id="pop-overlay"><div class="modal pop-modal"><div class="modal-head"><h3>${title}</h3><button class="x" data-pop-close>${ic("x", 18)}</button></div><div class="pop-body">${body}</div>${foot ? `<div class="pop-foot">${foot}</div>` : ""}</div></div>`;
  const first = el.querySelector("input"); if (first) first.focus();
}
function closePop() { state.pop = null; renderPop(); }
function openTxPop(id) { state.pop = { kind: "tx", id: String(id) }; renderPop(); }
function delTx(id) { const t = state.tx.find((x) => String(x.id) === String(id)); if (t) applyTxToBalance(t, -1); state.tx = state.tx.filter((x) => String(x.id) !== String(id)); refreshSideNet(); closePop(); renderView(); }
function openAcctForm() { state.pop = { kind: "acctForm" }; renderPop(); }
function saveAcctForm() {
  const g = (s) => document.querySelector(`[data-af="${s}"]`);
  const nome = g("nome").value.trim(); if (!nome) { g("nome").focus(); return; }
  const tipo = g("tipo").value, saldo = parseValor(g("saldo").value);
  const grupo = tipo === "patrimonio" ? "pat" : "fin";
  const sub = { invest: "Investimento", cartao: "Cartão", patrimonio: "Patrimônio", dinheiro: "Dinheiro", banco: "Conta" }[tipo];
  const o = { id: "u" + Date.now(), nome, sub, tipo, saldo, grupo, arquivada: false };
  if (grupo === "pat") { o.alocado = saldo; o.custo = 0; }
  accounts.push(o); reindexAccounts(); refreshSideNet(); closePop(); renderView();
}
// saldo/caixa inicial da conta (abertura) — editar re-baseia o saldo pra fechar mês negativo
function openAbertura(nome) {
  const a = acctByName(nome); if (!a) return;
  const cur = aberturaAtual(a).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  state.pop = { kind: "abertura", nome, cur };
  renderPop();
}
function saveAbertura(nome) {
  const a = acctByName(nome); if (!a) return;
  const inp = document.querySelector("[data-abertura-inp]");
  const novo = parseValor(inp ? inp.value : "");
  const delta = novo - aberturaAtual(a);
  a.saldo = Math.round((numOr0(a.saldo) + delta) * 100) / 100; // re-baseia: sobe/desce a reconstrução toda
  refreshSideNet(); closePop(); scheduleSave(); renderView();
}
/* ---------- visão patrimonial: metas de alocação e premissas ---------- */
function openMetas() { state.pop = { kind: "metas" }; renderPop(); }
function saveMetas() {
  const m = {};
  PAT_CLASSES.forEach((c) => { const el = document.querySelector(`[data-meta="${c.key}"]`); const v = parseValor(el ? el.value : ""); if (v) m[c.key] = v; });
  state.prefs.patMetas = m; closePop(); scheduleSave(); renderView();
}
function openPremissas() { state.pop = { kind: "premissas" }; renderPop(); }
function savePremissas() {
  const g = (s) => { const el = document.querySelector(`[data-prem="${s}"]`); return parseValor(el ? el.value : ""); };
  state.prefs.patPremissas = { ipca: g("ipca"), cdi: g("cdi") }; closePop(); scheduleSave(); renderView();
}
/* ---------- investimentos: ações ---------- */
function invDefaultConta() { const c = accounts.filter((a) => !a.arquivada && a.tipo === "invest"); return c[0] ? c[0].id : null; }
function openAssetMove(contaId) { state.pop = { kind: "assetMove", contaId: contaId || invDefaultConta(), tipo: "compra", data: TODAY_ISO }; renderPop(); }
function openAssetMoves(contaId) { state.pop = { kind: "assetMoves", contaId }; renderPop(); }
// clicar numa compra/venda no extrato → abre o mesmo modal em modo EDIÇÃO (com excluir)
function openAssetEdit(id) {
  const m = assetMoves.find((x) => String(x.id) === String(id));
  if (!m) return;
  const br = (n) => String(numOr0(n)).replace(".", ","); // número BR pro input (vírgula decimal)
  state.pop = { kind: "assetMove", id: m.id, contaId: m.contaId, tipo: m.tipo, data: m.iso || TODAY_ISO, ticker: m.ticker, nome: m.nome, classe: m.classe, qtd: br(m.qtd), preco: br(m.preco) };
  renderPop();
}
function invSetTipo(tipo) {
  if (!state.pop || state.pop.kind !== "assetMove") return;
  // preserva o que já foi digitado ao trocar compra⇄venda
  const g = (s) => { const el = document.querySelector(`[data-am="${s}"]`); return el ? el.value : ""; };
  Object.assign(state.pop, { tipo, conta: g("conta") || state.pop.contaId, data: g("data"), ticker: g("ticker"), nome: g("nome"), classe: g("classe"), qtd: g("qtd"), preco: g("preco"), contaId: g("conta") || state.pop.contaId });
  renderPop();
}
function saveAssetMove() {
  const g = (s) => { const el = document.querySelector(`[data-am="${s}"]`); return el ? el.value : ""; };
  const contaId = g("conta"), ticker = g("ticker").trim().toUpperCase();
  const qtd = parseValor(g("qtd")), preco = parseValor(g("preco"));
  if (!contaId || !ticker || qtd <= 0 || preco <= 0) { const t = document.querySelector('[data-am="ticker"]'); if (t && !ticker) t.focus(); return; }
  const p = state.pop || {};
  const dados = {
    contaId, iso: g("data") || TODAY_ISO, ticker, nome: g("nome").trim(),
    classe: g("classe") || "acao", tipo: p.tipo === "venda" ? "venda" : "compra", qtd, preco,
  };
  if (p.id) { const m = assetMoves.find((x) => String(x.id) === String(p.id)); if (m) Object.assign(m, dados); } // edição
  else assetMoves.push(Object.assign({ id: "am" + Date.now() }, dados)); // novo
  refreshSideNet(); closePop();
  scheduleSave(); renderView();
}
function delAssetMove(id) {
  const i = assetMoves.findIndex((m) => String(m.id) === String(id));
  if (i < 0) return;
  const contaId = assetMoves[i].contaId;
  assetMoves.splice(i, 1);
  refreshSideNet();
  // lista de lançamentos: re-renderiza (ou fecha se esvaziou); modal de edição: fecha
  if (state.pop && state.pop.kind === "assetMoves") { if (!assetMoves.some((m) => m.contaId === contaId)) closePop(); else renderPop(); }
  else closePop();
  scheduleSave(); renderView();
}
function invRefreshQuotes() {
  const btn = document.querySelector("[data-inv-refresh]");
  if (btn) { btn.disabled = true; btn.textContent = "Atualizando…"; }
  fetchQuotes().then((ok) => { refreshSideNet(); renderView(); });
}
function openCatForm(tipo, parent) { state.pop = { kind: "catForm", tipo, parent: parent || null }; renderPop(); }
function saveCatForm() {
  const p = state.pop, inp = document.querySelector('[data-cf="nome"]'), nome = inp ? inp.value.trim() : "";
  if (!nome) { if (inp) inp.focus(); return; }
  if (p.parent) { const node = catTree[p.tipo].find((c) => c.nome === p.parent); if (node && !node.subs.includes(nome)) node.subs.push(nome); }
  else if (!catTree[p.tipo].some((c) => c.nome === nome)) catTree[p.tipo].push({ nome, subs: [], total: 0 });
  closePop(); renderView();
}
/* donut de categorias: navegação, seleção, lançamentos */
function openDonutTx(arg) { const [tipo, cat, sub] = arg.split("|"); state.pop = { kind: "catTx", tipo, cat, sub: sub || null, ym: state.donut[tipo].month }; renderPop(); }
function donutMonthNav(tipo, dir) {
  const st = state.donut[tipo], months = monthsAxis(), i = months.indexOf(st.month), j = dir === "prev" ? i - 1 : i + 1;
  if (j < 0 || j >= months.length) return;
  st.month = months[j]; st.active = null; renderView();
}
function donutSelect(tipo, nome) { const st = state.donut[tipo]; st.active = st.active === nome ? null : nome; renderView(); }
function donutDrill(tipo, cat) { const st = state.donut[tipo]; st.drill = cat; st.active = null; renderView(); }
function donutBack(tipo) { const st = state.donut[tipo]; st.drill = null; st.active = null; renderView(); }
function resetDonuts() { state.donut.despesa.active = state.donut.despesa.drill = null; state.donut.receita.active = state.donut.receita.drill = null; }
/* editar / excluir categorias e subcategorias (com transbordo) */
function openCatEdit(tipo, nome) { const node = catTree[tipo].find((c) => c.nome === nome); state.pop = { kind: "catEdit", tipo, nome, curName: nome, editIcon: catIconOf(node) }; renderPop(); }
function saveCatRename() {
  const p = state.pop, inp = document.querySelector('[data-ce="nome"]'), nv = inp ? inp.value.trim() : (p.curName || "");
  const node = catTree[p.tipo].find((c) => c.nome === p.nome);
  if (node) {
    node.icon = p.editIcon;
    if (nv && nv !== p.nome && !catTree[p.tipo].some((c) => c.nome === nv)) {
      const old = node.nome; node.nome = nv;
      state.tx.forEach((t) => { if (t.cat === old) t.cat = nv; });
      if (state.catDetail && state.catDetail.cat === old) state.catDetail.cat = nv;
    }
    resetDonuts();
  }
  closePop(); renderView();
}
function openCatDelete(tipo, nome) { state.pop = { kind: "catDelete", tipo, nome }; renderPop(); }
function confirmCatDelete(tipo, nome) {
  const sel = document.querySelector('[data-cd="target"]'), tgt = sel ? sel.value : null;
  if (!tgt) return;
  const arr = catTree[tipo], node = arr.find((c) => c.nome === nome), tnode = arr.find((c) => c.nome === tgt);
  state.tx.forEach((t) => { if (t.cat === nome) { t.cat = tgt; t.sub = ""; } });
  if (tnode && node) tnode.total = (tnode.total || 0) + (node.total || 0);
  catTree[tipo] = arr.filter((c) => c.nome !== nome);
  if (state.catDetail && state.catDetail.cat === nome) state.catDetail = null;
  resetDonuts();
  closePop(); renderView();
}
function openSubEdit(tipo, parent, sub) { state.pop = { kind: "subEdit", tipo, parent, sub }; renderPop(); }
function saveSubRename() {
  const p = state.pop, inp = document.querySelector('[data-se="nome"]'), selP = document.querySelector('[data-se="parent"]');
  const nv = inp ? inp.value.trim() : "", np = selP ? selP.value : p.parent;
  if (!nv) { if (inp) inp.focus(); return; }
  const oldNode = catTree[p.tipo].find((c) => c.nome === p.parent);
  const newNode = catTree[p.tipo].find((c) => c.nome === np);
  if (!oldNode || !newNode) { closePop(); renderView(); return; }
  const moved = np !== p.parent, renamed = nv !== p.sub;
  if (moved) {
    // não deixa mover para uma categoria que já tem uma sub com esse nome
    if (newNode.subs.includes(nv)) { if (inp) inp.focus(); return; }
    oldNode.subs = oldNode.subs.filter((s) => s !== p.sub);
    newNode.subs.push(nv);
    state.tx.forEach((t) => { if (t.cat === p.parent && t.sub === p.sub) { t.cat = np; t.sub = nv; } });
    if (state.catDetail && state.catDetail.cat === p.parent && state.catDetail.sub === p.sub) { state.catDetail.cat = np; state.catDetail.sub = nv; }
  } else if (renamed) {
    const i = oldNode.subs.indexOf(p.sub);
    if (i >= 0 && !oldNode.subs.includes(nv)) {
      oldNode.subs[i] = nv;
      state.tx.forEach((t) => { if (t.cat === p.parent && t.sub === p.sub) t.sub = nv; });
      if (state.catDetail && state.catDetail.cat === p.parent && state.catDetail.sub === p.sub) state.catDetail.sub = nv;
    }
  }
  closePop(); renderView();
}
function openSubDelete(tipo, parent, sub) { state.pop = { kind: "subDelete", tipo, parent, sub }; renderPop(); }
function confirmSubDelete(tipo, parent, sub) {
  const sel = document.querySelector('[data-sd="target"]'), tgt = sel ? sel.value : "";
  const node = catTree[tipo].find((c) => c.nome === parent);
  if (node) { node.subs = node.subs.filter((s) => s !== sub); state.tx.forEach((t) => { if (t.cat === parent && t.sub === sub) t.sub = tgt; }); }
  if (state.catDetail && state.catDetail.cat === parent && state.catDetail.sub === sub) state.catDetail = null;
  closePop(); renderView();
}
/* ---------- hover do gráfico de patrimônio ---------- */
function pcShow(pc, i) {
  if (!pc) return;
  const dot = pc.querySelector(`[data-pt="${i}"]`); if (!dot) return;
  pc.querySelectorAll(".pc-dot.on").forEach((d) => d.classList.remove("on")); dot.classList.add("on");
  const guide = pc.querySelector(".pc-guide"), tip = pc.querySelector(".pc-tip");
  const val = parseFloat(dot.dataset.val), delta = parseFloat(dot.dataset.delta);
  if (guide) { guide.hidden = false; guide.style.left = dot.style.left; }
  if (tip) {
    tip.hidden = false; tip.style.left = dot.style.left; tip.style.top = dot.style.top;
    tip.innerHTML = `<b>${dot.dataset.mes}</b><span class="num">${fmt(val)}</span>${delta ? `<span class="num pc-d ${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "+" : "−"} ${fmtNum(delta)}</span>` : ""}`;
  }
}
function pcHide(pc) { if (!pc) return; pc.querySelectorAll(".pc-dot.on").forEach((d) => d.classList.remove("on")); const g = pc.querySelector(".pc-guide"), t = pc.querySelector(".pc-tip"); if (g) g.hidden = true; if (t) t.hidden = true; }

// mudança em um campo da edição inline (mantém subcategoria dependente da categoria)
function reconFieldChange(id, field, value) {
  const r = state.recon.find((x) => String(x.id) === String(id)); if (!r) return;
  if (field === "sub") { r.sug.sub = value; return; }
  if (field === "conta") { r.sug.conta = value; return; }
  if (field === "origem") { r.sug.origem = value; return; }
  if (field === "destino") { r.sug.destino = value; return; }
  if (field === "desc") { r.raw = value; return; }
  if (field === "data") { r.iso = value; return; }
  // tipo/cat mudam os selects dependentes → preserva desc/data digitados e re-renderiza
  const scope = document.querySelector(`[data-recon-id="${id}"]`);
  if (scope) { const d = scope.querySelector('[data-recon-field="desc"]'); if (d) r.raw = d.value; const dt = scope.querySelector('[data-recon-field="data"]'); if (dt) r.iso = dt.value; }
  if (field === "tipo") {
    const tipoKey = Object.keys(TIPOS).find((k) => TIPOS[k].label === value) || value;
    r.sug.tipo = tipoKey;
    if (tipoKey !== "transferencia") { const list = catTree[tipoKey === "receita" ? "receita" : "despesa"]; r.sug.cat = list[0] ? list[0].nome : ""; r.sug.sub = ""; }
    else { const ativas = accounts.filter((a) => !a.arquivada); r.sug.origem = r.sug.origem || r.sug.conta || state.reconAccount || (ativas[0] && ativas[0].nome); r.sug.destino = r.sug.destino || (ativas.find((a) => a.nome !== r.sug.origem) || {}).nome || ""; }
  } else if (field === "cat") { r.sug.cat = value; r.sug.sub = ""; }
  renderView();
}
function reconAccept(id) {
  const r0 = state.recon.find((r) => r.id === id);
  let patch = {};
  if (state.editing === id && r0) {
    const scope = document.querySelector(`[data-recon-id="${id}"]`);
    if (scope) {
      const val = (f) => { const el = scope.querySelector(`[data-recon-field="${f}"]`); return el ? el.value : null; };
      const tipoKey = Object.keys(TIPOS).find((k) => TIPOS[k].label === val("tipo")) || r0.sug.tipo;
      patch = { sug: { ...r0.sug, tipo: tipoKey, cat: val("cat") || r0.sug.cat, sub: val("sub") != null ? val("sub") : r0.sug.sub, conta: val("conta") || r0.sug.conta, origem: val("origem") || r0.sug.origem, destino: val("destino") || r0.sug.destino } };
      const desc = val("desc"); if (desc != null && desc.trim()) patch.raw = desc.trim();
      const data = val("data"); if (data) patch.iso = data;
    }
  }
  // aceitar é uma decisão reversível — nada é gravado até "Salvar conciliação" (reconCommit)
  state.recon = state.recon.map((r) => (r.id === id ? { ...r, ...patch, status: "conciliado" } : r));
  state.editing = null; renderView();
}
// aceita de uma vez tudo que está pendente (o caminho normal quando o extrato traz muitos itens novos)
function reconAcceptAll() { state.recon = state.recon.map((r) => (r.status === "pendente" ? { ...r, status: "conciliado" } : r)); state.editing = null; renderView(); }
// "importar mesmo assim": aceita também os que vieram com ✕ por já existirem. Continua pulando as
// parcelas n>1 (o total já entrou na 1ª — aceitá-las lançaria o valor em dobro de verdade).
function reconAcceptDup() { state.recon = state.recon.map((r) => (r.status === "ignorado" && r.match && !r.pulado ? { ...r, status: "conciliado" } : r)); state.editing = null; renderView(); }
function reconIgnore(id) { state.recon = state.recon.map((r) => (r.id === id ? { ...r, status: "ignorado" } : r)); state.editing = null; renderView(); }
function reconReactivate(id) { state.recon = state.recon.map((r) => (r.id === id ? { ...r, status: "pendente" } : r)); state.editing = null; renderView(); }
// grava de vez: cria TODOS os lançamentos aceitos e encerra a sessão.
// Item com correspondência já vem com ✕ (proteção contra duplicata), mas se o usuário reativou e
// aceitou, ele QUER importar — antes o commit filtrava `!r.match` e simplesmente não criava nada,
// então reimportar um extrato já lançado era impossível por qualquer caminho.
function reconCommit() {
  const aceitos = state.recon.filter((r) => r.status === "conciliado");
  if (!aceitos.length) return;
  const novos = aceitos.map(reconToTx);
  const dup = aceitos.filter((r) => r.match).length;
  const banco = parseSaldo(state.reconBank), contaConc = state.reconAccount;
  if (novos.length) { novos.forEach((t) => applyTxToBalance(t, 1)); state.tx = [...novos, ...state.tx]; sortTx(); }
  // batimento pós-save: agora os saldos já refletem os lançamentos criados, então compara o saldo
  // real da conta com o que o usuário digitou do banco (0 = bateu na vírgula)
  let bat = null;
  if (banco !== null) {
    const a = accounts.find((x) => x.nome === contaConc);
    bat = { banco, saldo: numOr0(a && a.saldo), falta: Math.round((banco - numOr0(a && a.saldo)) * 100) / 100 };
  }
  state.recon = []; state.reconFiles = []; state.imported = false; state.reconAccount = null; state.editing = null; state.reconBank = "";
  state.reconDone = { criados: novos.length, dup, bat };
  refreshSideNet();
  renderView();
}
function reconEdit(id) { state.editing = state.editing === id ? null : id; renderView(); }

/* ---------- motor de conciliação (lê OFX/CSV, sugere, casa duplicatas) ---------- */
let _txSeq = 0;
function parseOFX(text) {
  const out = [];
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  const tag = (b, t) => { const m = b.match(new RegExp("<" + t + ">\\s*([^<\r\n]*)", "i")); return m ? m[1].trim() : ""; };
  blocks.forEach((b) => {
    const amt = parseFloat(tag(b, "TRNAMT").replace(",", "."));
    const dt = tag(b, "DTPOSTED").slice(0, 8);
    const iso = dt.length === 8 ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}` : "";
    const desc = tag(b, "NAME") || tag(b, "MEMO") || "Lançamento";
    if (!isNaN(amt)) out.push({ iso, desc, valor: amt });
  });
  return out;
}
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const delim = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ";" : ",";
  const dateRe = /\d{2}[\/\-]\d{2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2}/;
  const parseNum = (s) => { s = (s || "").replace(/["R$\s]/g, "").trim(); if (!/\d/.test(s)) return NaN; if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", "."); else s = s.replace(/,/g, ""); return parseFloat(s); };
  const toIso = (s) => { let m = String(s).match(/(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/); if (m) { let y = m[3].length === 2 ? "20" + m[3] : m[3]; return `${y}-${m[2]}-${m[1]}`; } m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : ""; };
  const out = [];
  lines.forEach((l) => {
    const cols = l.split(delim);
    const di = cols.findIndex((c) => dateRe.test(c)); if (di < 0) return;
    let amt = NaN, ai = -1;
    for (let j = cols.length - 1; j >= 0; j--) { if (j === di) continue; const n = parseNum(cols[j]); if (!isNaN(n) && /[.,]|^-?\d+$/.test(cols[j].trim())) { amt = n; ai = j; break; } }
    if (isNaN(amt)) return;
    let desc = "";
    cols.forEach((c, j) => { if (j !== di && j !== ai && c && c.trim().length > desc.length && !/^-?[\d.,]+$/.test(c.trim())) desc = c.trim(); });
    out.push({ iso: toIso(cols[di]), desc: desc || "Lançamento", valor: amt });
  });
  return out;
}
/* ---------- PDF (extrato Mercado Pago) — leitura por coordenadas via pdf.js ---------- */
let _pdfLib = null;
function loadPdfLib() {
  if (!_pdfLib) _pdfLib = import("./vendor/pdf.min.js").then((m) => { const lib = m.default || m; lib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js"; return lib; });
  return _pdfLib;
}
// reconstrói UMA página do extrato: cada transação é ancorada na coluna "Valor"; data e descrição
// (que pode ter várias linhas) são casadas à âncora mais próxima em y. Bandas de x = layout do MP.
function mpParsePage(items) {
  const money = (s) => { const m = String(s).match(/R\$\s*(-?)\s*([\d.]+),(\d{2})/); if (!m) return null; const n = parseFloat(m[2].replace(/\./g, "") + "." + m[3]); return m[1] === "-" ? -n : n; };
  const toIso = (s) => { const m = String(s).match(/(\d{2})-(\d{2})-(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };
  const anchors = [], dates = [], descs = [];
  for (const it of items) {
    const s = (it.str || "").trim(); if (!s) continue;
    const x = it.x, y = it.y, v = money(s);
    if (v !== null && x >= 270 && x < 348) { anchors.push({ y, valor: v }); continue; } // coluna Valor (não pega o resumo nem o Saldo)
    else if (x < 85 && /^\d{2}-\d{2}-\d{4}$/.test(s)) dates.push({ y, iso: toIso(s) });   // coluna Data
    else if (x >= 85 && x < 190) descs.push({ y, s });                                     // coluna Descrição
  }
  const near = (arr, y, tol) => { let best = null, bd = tol; for (const a of arr) { const d = Math.abs(a.y - y); if (d <= bd) { bd = d; best = a; } } return best; };
  const nearestAnchor = (y) => { let bi = -1, bd = 1e9; anchors.forEach((a, i) => { const d = Math.abs(a.y - y); if (d < bd) { bd = d; bi = i; } }); return { i: bi, d: bd }; };
  const bucket = anchors.map(() => []);
  for (const d of descs) { const { i, d: dist } = nearestAnchor(d.y); if (i >= 0 && dist <= 20) bucket[i].push(d); } // > 20 = rodapé/resumo, descarta
  return anchors.map((a, i) => {
    const dt = near(dates, a.y, 12);
    const desc = bucket[i].sort((p, q) => q.y - p.y).map((d) => d.s).join(" ").replace(/\s+/g, " ").trim();
    return { iso: dt ? dt.iso : "", desc: desc || "Lançamento", valor: a.valor };
  });
}
async function parsePDF(buffer) {
  const pdfjs = await loadPdfLib();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  let out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    out = out.concat(mpParsePage(tc.items.map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }))));
  }
  return out;
}
const RECON_RULES = [
  { kw: ["ifood", "rappi", "restaurante", "lanche", "burger", "pizza", "bar ", "padaria"], cat: "LAZER", sub: "Comer fora" },
  { kw: ["uber", "99app", "99 ", "posto", "shell", "ipiranga", "combustiv", "estacion", "pedagio", "sem parar"], cat: "Custo de Vida", sub: "Carro" },
  { kw: ["mercado", "supermerc", "nordestao", "carrefour", "feira", "hortifruti", "atacad", "assai"], cat: "Custo de Vida", sub: "Feira" },
  { kw: ["netflix", "spotify", "assinatura", "prime", "hbo", "disney", "youtube"], cat: "Custo de Vida", sub: "Assinaturas" },
  { kw: ["farmacia", "drogaria", "consulta", "medic", "hospital", "unimed", "plano de saude"], cat: "Custo de Vida", sub: "Plano de saude" },
  { kw: ["aluguel", "condominio", "energia", "enel", "cemig", "agua", "internet", "vivo", "claro", "tim ", "net "], cat: "Casa", sub: "Contas" },
  { kw: ["salario", "pro-labore", "pro labore", "prolabore"], cat: "Trabalho", sub: "Salário", tipo: "receita" },
  { kw: ["dividendo", "juros", "rendimento", "cdb", "tesouro", "renda fixa", "aplicacao resgate"], cat: "Rendimentos financeiros", sub: "Renda Fixa", tipo: "receita" },
  { kw: ["aporte", "investimento", "aplicacao", "compra ativo"], cat: "Investimento", sub: "Investimento" },
  { kw: ["amazon", "mercado livre", "mercadolivre", "magazine", "aliexpress", "shopee", "loja", "roupa", "renner"], cat: "Compras", sub: "" },
];
// `used` = ids de lançamentos já casados por outro item deste mesmo extrato. Sem isso, duas compras
// idênticas no extrato casavam as duas com o MESMO lançamento existente e a segunda (que é nova de
// verdade) era silenciosamente engolida como duplicata.
function findReconMatch(p, used) {
  if (!p.iso) return null;
  const acc = state.reconAccount;
  // só casa com lançamentos da MESMA conta que está sendo conciliada — senão uma compra do cartão
  // "casaria" falsamente com um lançamento de outra conta do mesmo valor e não seria criada no commit.
  return state.tx.find((t) => t.status !== "importado"
    && !(used && used.has(t.id))
    && (t.conta === acc || t.origem === acc || t.destino === acc)
    && Math.abs(Math.abs(t.valor) - Math.abs(p.valor)) < 0.01
    && t.iso && Math.abs((new Date(t.iso) - new Date(p.iso)) / 864e5) <= 3) || null;
}
// ids já casados pelos itens atuais da conciliação (usado ao adicionar item manualmente)
function reconUsedIds() { const s = new Set(); state.recon.forEach((r) => { if (r.matchId != null) s.add(r.matchId); }); return s; }
function catExists(tipo, nome) { return catTree[tipo] && catTree[tipo].some((c) => c.nome === nome); }
// detecta parcela "N/M" na descrição (com palavra parcela, ou N/M ao fim) — evita confundir com data
function parseInstallment(desc) {
  const d = (desc || "").trim();
  const m = d.match(/parc\w*\D*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/i)
    || d.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*$/)
    || d.match(/\b(\d{1,2})\s+de\s+(\d{1,2})\s*$/i);
  if (!m) return null;
  const n = +m[1], tot = +m[2];
  if (tot < 2 || tot > 24 || n < 1 || n > tot) return null;
  return { n, m: tot };
}
function buildRecon(parsed, account) {
  // Cartão: fatura (ex.: Nubank) costuma trazer compras como valor POSITIVO. Se num cartão a maioria
  // dos valores é positiva, inverte o sinal para que compras contem como despesa.
  const acc = accounts.find((a) => a.nome === account);
  let flip = 1;
  if (acc && acc.tipo === "cartao") {
    const pos = parsed.filter((p) => p.valor > 0).length, neg = parsed.filter((p) => p.valor < 0).length;
    if (pos > neg) flip = -1;
  }
  const isPay = (d) => /pagamento\s*(recebido|de\s*fatura|fatura)?|pgto|pagto/i.test(d || "");
  // conta de origem plausível pro pagamento da fatura (antes era a string "Pagamento", uma conta que
  // não existe — o saldo entrava no cartão sem sair de lugar nenhum). O usuário confirma/edita.
  const origemPad = (accounts.find((a) => !a.arquivada && a.grupo === "fin" && a.tipo !== "cartao" && a.nome !== account) || {}).nome || account;
  const used = new Set(); // cada lançamento existente só casa com UM item do extrato
  return parsed.slice(0, 300).map((p, idx) => {
    // pagamento de fatura do cartão → transferência (não é receita/despesa do orçamento)
    if (acc && acc.tipo === "cartao" && isPay(p.desc) && p.valor * flip > 0) {
      // também procura correspondência: sem isso, reimportar o mesmo extrato duplicava o pagamento
      const pm = findReconMatch({ iso: p.iso, valor: Math.abs(p.valor) }, used);
      if (pm) used.add(pm.id);
      return { id: "imp" + idx, raw: p.desc, valor: Math.abs(p.valor), iso: p.iso, sug: { tipo: "transferencia", origem: origemPad, destino: account }, conf: 90, match: pm ? `${pm.desc} · ${pm.data}` : null, matchId: pm ? pm.id : null, status: pm ? "ignorado" : "pendente", note: "Pagamento de fatura — transferência, não entra no orçamento (confira a conta de origem)" };
    }
    const inst = parseInstallment(p.desc);
    let valor = p.valor * flip, status = "pendente", note = null, pulado = false;
    if (inst) {
      if (inst.n === 1) { valor = valor * inst.m; note = `Parcela 1/${inst.m} — importando o valor cheio (${inst.m}×)`; }
      else { status = "ignorado"; pulado = true; note = `Parcela ${inst.n}/${inst.m} — o total já foi lançado na 1ª`; }
    }
    const isDesp = valor < 0;
    const rule = RECON_RULES.find((r) => r.kw.some((k) => (p.desc || "").toLowerCase().includes(k)));
    const tipo = rule && rule.tipo ? rule.tipo : (isDesp ? "despesa" : "receita");
    // categoria: da regra se existir, senão a 1ª do tipo
    const catObj = (rule && catExists(tipo, rule.cat) ? catTree[tipo].find((c) => c.nome === rule.cat) : catTree[tipo][0]) || null;
    const cat = catObj ? catObj.nome : "Outros";
    // subcategoria SEMPRE pré-preenchida: a da regra se pertencer à categoria, senão a 1ª sub real
    // (ignora o fallback em que a única "sub" é o próprio nome da categoria)
    const firstSub = catObj ? (catObj.subs.find((s) => s !== catObj.nome) || "") : "";
    const sub = (rule && rule.sub && catObj && catObj.subs.includes(rule.sub)) ? rule.sub : firstSub;
    const match = findReconMatch({ iso: p.iso, valor }, used);
    if (match) { used.add(match.id); status = "ignorado"; } // já existe um lançamento igual → vem marcado com X (reative p/ contar)
    const conf = Math.min((rule ? 85 : 55) + (match ? 12 : 0), 99);
    return { id: "imp" + idx, raw: p.desc, valor: Math.abs(valor) * (isDesp ? -1 : 1), iso: p.iso, sug: { tipo, cat, sub, conta: account }, conf, match: match ? `${match.desc} · ${match.data}` : null, matchId: match ? match.id : null, status, note, pulado };
  });
}
let _manSeq = 0;
// "Adicionar lançamento" abre o MESMO modal de Nova transação, mas em modo conciliação
function openReconAdd() {
  state.modalRecon = true; state.modal = true; state.editTx = null;
  state.modalTipo = "despesa"; state.form = freshForm();
  if (state.reconAccount) { state.form.conta = state.reconAccount; state.form.origem = state.reconAccount; }
  state.acctMenu = null; state.pop = null;
  renderPop(); renderModal();
}
// converte o formulário do modal num item de conciliação (pendente), como se viesse do extrato
function formToRecon() {
  const v = parseValor(state.form.valor);
  const tipo = state.modalTipo === "receita" && state.form.reembolso ? "reembolso" : state.modalTipo;
  const iso = state.form.data || TODAY_ISO;
  const raw = (state.form.desc || "").trim() || TIPOS[tipo].label;
  const id = "man" + (_manSeq++);
  if (tipo === "transferencia") {
    const origem = state.form.origem || state.reconAccount, destino = state.form.destino || "—";
    const sign = destino === state.reconAccount ? 1 : -1;
    return { id, raw, valor: sign * Math.abs(v), iso, sug: { tipo: "transferencia", origem, destino }, conf: 100, match: null, status: "pendente", manual: true };
  }
  const signed = tipo === "despesa" ? -Math.abs(v) : Math.abs(v);
  const match = findReconMatch({ iso, valor: signed }, reconUsedIds());
  return { id, raw, valor: signed, iso, sug: { tipo, cat: state.form.cat, sub: state.form.sub, conta: state.form.conta || state.reconAccount }, conf: 100, match: match ? `${match.desc} · ${match.data}` : null, matchId: match ? match.id : null, status: "pendente", manual: true };
}
// cria o lançamento de ajuste (plug) do valor exato da diferença com o banco, como item pendente
// (aceitar/editar/ignorar). Positivo ⇒ receita; negativo ⇒ despesa. Categoria default = a 1ª do tipo
// (editável antes de aceitar). Some da UI assim que a diferença zera.
function reconPlug() {
  const d = reconDiff();
  if (d.banco === null || d.diff === 0) return;
  const tipo = d.diff > 0 ? "receita" : "despesa";
  const list = tipo === "receita" ? catTree.receita : catTree.despesa;
  const catObj = list[0] || { nome: "", subs: [] };
  const item = {
    id: "man" + (_manSeq++), raw: "Ajuste de saldo (conciliação)", valor: d.diff, iso: TODAY_ISO,
    sug: { tipo, cat: catObj.nome, sub: (catObj.subs && catObj.subs[0]) || "", conta: state.reconAccount },
    conf: 100, match: null, matchId: null, status: "pendente", manual: true, ajuste: true,
  };
  state.recon = [item, ...state.recon];
  state.editing = null;
  renderView();
}
function reconToTx(r) {
  const iso = r.iso || TODAY_ISO, tipo = r.sug.tipo;
  const base = { id: Date.now() + (_txSeq++), data: dataBR(iso), iso, desc: r.raw || TIPOS[tipo].label, tipo, status: "conciliado" };
  if (tipo === "transferencia") return { ...base, origem: r.sug.origem || r.sug.conta, destino: r.sug.destino || "—", valor: Math.abs(r.valor) };
  const list = tipo === "receita" ? catTree.receita : catTree.despesa, catObj = list.find((c) => c.nome === r.sug.cat);
  return { ...base, cat: r.sug.cat, sub: r.sug.sub || (catObj && catObj.subs[0]) || "", conta: r.sug.conta, valor: tipo === "despesa" ? -Math.abs(r.valor) : Math.abs(r.valor) };
}
function addReconFile(file) {
  state.reconDone = null;
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const entry = { name: file.name, ext, parsed: ["ofx", "csv", "txt", "pdf"].includes(ext) ? null : "unsupported" };
  state.reconFiles.push(entry);
  if (entry.parsed === null) {
    const reader = new FileReader();
    reader.onerror = () => { entry.parsed = []; renderView(); };
    if (ext === "pdf") {
      reader.onload = () => { parsePDF(reader.result).then((rows) => { entry.parsed = rows; renderView(); }).catch(() => { entry.parsed = []; renderView(); }); };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = () => { try { entry.parsed = ext === "ofx" ? parseOFX(reader.result) : parseCSV(reader.result); } catch (e) { entry.parsed = []; } renderView(); };
      reader.readAsText(file);
    }
  }
  renderView();
}
function addReconFiles(fileList) { [...fileList].forEach(addReconFile); }
function reconAllParsed() { return state.reconFiles.reduce((a, f) => (Array.isArray(f.parsed) ? a.concat(f.parsed) : a), []); }
const ACTIONS = {
  "open-modal": openModal,
  "close-modal": closeModal,
  "save-tx": saveTx,
  "import": () => {
    state.reconDone = null; state.reconBank = "";
    const sel = document.querySelector("[data-imp-acct]");
    state.reconAccount = sel ? sel.value : (accounts.find((a) => !a.arquivada) || {}).nome;
    const all = reconAllParsed();
    if (!all.length) return; // sem arquivos lidos não há o que importar (botão fica desabilitado)
    state.recon = buildRecon(all, state.reconAccount);
    state.imported = true; state.editing = null; renderView();
  },
  // prosseguir SEM arquivo: entra na conciliação com a lista vazia — pra conferir o saldo do banco
  // (batimento) e/ou lançar à mão. Mesmo destino do `import`, só que sem extrato lido.
  "recon-empty": () => {
    state.reconDone = null; state.reconBank = "";
    const sel = document.querySelector("[data-imp-acct]");
    state.reconAccount = sel ? sel.value : (accounts.find((a) => !a.arquivada) || {}).nome;
    state.recon = []; state.reconFiles = [];
    state.imported = true; state.editing = null; renderView();
  },
  "reimport": () => { state.imported = false; state.reconAccount = null; state.reconFiles = []; state.editing = null; state.reconBank = ""; renderView(); },
};

function wire() {
  document.addEventListener("click", (e) => {
    if (e.target.id === "overlay") { closeModal(); return; }
    if (e.target.id === "drill-overlay") { closeDrill(); return; }
    if (e.target.id === "pop-overlay") { closePop(); return; }
    if (e.target.closest("[data-pop-close]")) { closePop(); return; }
    const txo = e.target.closest("[data-tx-open]");
    if (txo) { openTxPop(txo.dataset.txOpen); return; }
    const txd = e.target.closest("[data-tx-del]");
    if (txd) { delTx(txd.dataset.txDel); return; }
    const txe = e.target.closest("[data-tx-edit]");
    if (txe) { openEditTx(txe.dataset.txEdit); return; }
    if (e.target.closest("[data-add-acct]")) { openAcctForm(); return; }
    if (e.target.closest("[data-acct-form-save]")) { saveAcctForm(); return; }
    // investimentos
    if (e.target.closest("[data-inv-refresh]")) { invRefreshQuotes(); return; }
    const iAdd = e.target.closest("[data-inv-add]");
    if (iAdd) { openAssetMove(iAdd.dataset.invAdd); return; }
    const iMoves = e.target.closest("[data-inv-moves]");
    if (iMoves) { openAssetMoves(iMoves.dataset.invMoves); return; }
    const iOpen = e.target.closest("[data-asset-open]");
    if (iOpen) { openAssetEdit(iOpen.dataset.assetOpen); return; }
    const iTipo = e.target.closest("[data-am-tipo]");
    if (iTipo) { invSetTipo(iTipo.dataset.amTipo); return; }
    if (e.target.closest("[data-inv-save]")) { saveAssetMove(); return; }
    const iDel = e.target.closest("[data-inv-del]");
    if (iDel) { delAssetMove(iDel.dataset.invDel); return; }
    const abt = e.target.closest("[data-abertura]");
    if (abt) { openAbertura(abt.dataset.abertura); return; }
    const abtS = e.target.closest("[data-abertura-save]");
    if (abtS) { saveAbertura(abtS.dataset.aberturaSave); return; }
    // visão patrimonial
    if (e.target.closest("[data-pat-reg]")) { registrarMes(); return; }
    if (e.target.closest("[data-pat-metas]")) { openMetas(); return; }
    if (e.target.closest("[data-metas-save]")) { saveMetas(); return; }
    if (e.target.closest("[data-pat-prem]")) { openPremissas(); return; }
    if (e.target.closest("[data-prem-save]")) { savePremissas(); return; }
    const adc = e.target.closest("[data-add-cat]");
    if (adc) { openCatForm(adc.dataset.addCat); return; }
    const ads = e.target.closest("[data-add-sub]");
    if (ads) { const [tipo, parent] = ads.dataset.addSub.split("|"); openCatForm(tipo, parent); return; }
    if (e.target.closest("[data-cat-form-save]")) { saveCatForm(); return; }
    const pr = e.target.closest("[data-pcrange]");
    if (pr) { state.pcRange = pr.dataset.pcrange; state.pcSel = null; renderView(); return; }
    const rdr = e.target.closest("[data-rdrange]");
    if (rdr) { state.rdRange = rdr.dataset.rdrange; renderView(); return; }
    if (e.target.closest("[data-pcsel-clear]")) { state.pcSel = null; renderView(); return; }
    const dm = e.target.closest("[data-donut-month]");
    if (dm) { const [tp, dir] = dm.dataset.donutMonth.split("|"); donutMonthNav(tp, dir); return; }
    const ddr = e.target.closest("[data-donut-drill]");
    if (ddr) { const [tp, cat] = ddr.dataset.donutDrill.split("|"); donutDrill(tp, cat); return; }
    const dbk = e.target.closest("[data-donut-back]");
    if (dbk) { donutBack(dbk.dataset.donutBack); return; }
    const dtx = e.target.closest("[data-donut-tx]");
    if (dtx) { openDonutTx(dtx.dataset.donutTx); return; }
    const dsl = e.target.closest("[data-donut-slice]");
    if (dsl) { const [tp, nome] = dsl.dataset.donutSlice.split("|"); donutSelect(tp, nome); return; }
    const cei = e.target.closest("[data-ce-icon]");
    if (cei) { const inp = document.querySelector('[data-ce="nome"]'); if (inp) state.pop.curName = inp.value; state.pop.editIcon = cei.dataset.ceIcon; renderPop(); return; }
    const aei = e.target.closest("[data-ae-icon]");
    if (aei) { const inp = document.querySelector('[data-ae="nome"]'); if (inp) state.pop.curName = inp.value; state.pop.editIcon = aei.dataset.aeIcon; renderPop(); return; }
    const aes = e.target.closest("[data-acct-edit-save]");
    if (aes) { saveAcctEditForm(aes.dataset.acctEditSave); return; }
    const iclr = e.target.closest("[data-imp-clear]");
    if (iclr) { state.reconFiles.splice(+iclr.dataset.impClear, 1); renderView(); return; }
    const idrop = e.target.closest("[data-imp-drop]");
    if (idrop && !e.target.closest("[data-imp-file]")) { const inp = idrop.querySelector("[data-imp-file]"); if (inp) inp.click(); return; }
    const cdet = e.target.closest("[data-cat-detail]");
    if (cdet) { const [tp, ct, sb] = cdet.dataset.catDetail.split("|"); openCatDetail(tp, ct, sb); return; }
    if (e.target.closest("[data-cat-detail-back]")) { state.catDetail = null; renderView(); return; }
    if (e.target.closest("[data-cat-detail-edit]")) { const d = state.catDetail; d.sub ? openSubEdit(d.tipo, d.cat, d.sub) : openCatEdit(d.tipo, d.cat); return; }
    if (e.target.closest("[data-cat-detail-del]")) { const d = state.catDetail; d.sub ? openSubDelete(d.tipo, d.cat, d.sub) : openCatDelete(d.tipo, d.cat); return; }
    const cedit = e.target.closest("[data-cat-edit]");
    if (cedit) { const [tp, nm] = cedit.dataset.catEdit.split("|"); openCatEdit(tp, nm); return; }
    const cdel = e.target.closest("[data-cat-del]");
    if (cdel) { const [tp, nm] = cdel.dataset.catDel.split("|"); openCatDelete(tp, nm); return; }
    if (e.target.closest("[data-cat-rename-save]")) { saveCatRename(); return; }
    const cdc = e.target.closest("[data-cat-del-confirm]");
    if (cdc) { const [tp, nm] = cdc.dataset.catDelConfirm.split("|"); confirmCatDelete(tp, nm); return; }
    const sedit = e.target.closest("[data-sub-edit]");
    if (sedit) { const [tp, pa, su] = sedit.dataset.subEdit.split("|"); openSubEdit(tp, pa, su); return; }
    if (e.target.closest("[data-sub-rename-save]")) { saveSubRename(); return; }
    const sdela = e.target.closest("[data-sub-del-ask]");
    if (sdela) { const [tp, pa, su] = sdela.dataset.subDelAsk.split("|"); openSubDelete(tp, pa, su); return; }
    const sdelc = e.target.closest("[data-sub-del-confirm]");
    if (sdelc) { const [tp, pa, su] = sdelc.dataset.subDelConfirm.split("|"); confirmSubDelete(tp, pa, su); return; }
    const tabBtn = e.target.closest("[data-tab]");
    if (tabBtn) { state.tab = tabBtn.dataset.tab; state.acctDetail = null; state.acctMenu = null; state.acctEdit = null; state.catDetail = null; renderView(); if (state.tab === "historico") loadHistorico(true); if (state.tab === "patrimonial" && hasHoldings()) { if (!quotesTs) fetchQuotes().then((ok) => { if (ok) { refreshSideNet(); renderView(); } }); fetchHistory().then((ok) => { if (ok) renderView(); }); } return; }
    if (e.target.closest("[data-hist-refresh]")) { loadHistorico(true); return; }
    const hday = e.target.closest("[data-hist-day]");
    if (hday) { const k = hday.dataset.histDay; if (!state.histOpen) state.histOpen = new Set(); state.histOpen.has(k) ? state.histOpen.delete(k) : state.histOpen.add(k); const r = document.getElementById("hist-root"); if (r) r.innerHTML = renderHistBody(); return; }
    if (e.target.closest("[data-config-save-name]")) { saveConfigName(); return; }
    if (e.target.closest("[data-config-export]")) { exportBackup(); return; }
    const filt = e.target.closest("[data-filter]");
    if (filt) { state.filter = filt.dataset.filter; renderView(); return; }
    // drill-down
    if (e.target.closest("[data-drill]")) { openDrill(); return; }
    const dMonth = e.target.closest("[data-drill-month]");
    if (dMonth) { drillMonth(dMonth.dataset.drillMonth); return; }
    const dType = e.target.closest("[data-drill-type]");
    if (dType) { drillType(dType.dataset.drillType); return; }
    const dBack = e.target.closest("[data-drill-back]");
    if (dBack) { drillBack(dBack.dataset.drillBack); return; }
    if (e.target.closest("[data-drill-close]")) { closeDrill(); return; }
    // contas
    const aMenu = e.target.closest("[data-acct-menu]");
    if (aMenu) { toggleAcctMenu(aMenu.dataset.acctMenu); return; }
    const aEdit = e.target.closest("[data-acct-edit]");
    if (aEdit) { startEditAcct(aEdit.dataset.acctEdit); return; }
    const aSave = e.target.closest("[data-acct-save]");
    if (aSave) { saveAcctName(aSave.dataset.acctSave); return; }
    if (e.target.closest("[data-acct-cancel]")) { cancelEditAcct(); return; }
    const aMove = e.target.closest("[data-acct-move]");
    if (aMove) { const [id, dir] = aMove.dataset.acctMove.split(":"); moveAcct(id, dir); return; }
    const aArch = e.target.closest("[data-acct-archive]");
    if (aArch) { toggleArchive(aArch.dataset.acctArchive); return; }
    const aOpen = e.target.closest("[data-acct-open]");
    if (aOpen) { openAcct(aOpen.dataset.acctOpen); return; }
    if (e.target.closest("[data-acct-back]")) { backAcct(); return; }
    // dashboard
    if (e.target.closest("[data-dash-edit]")) { state.dashEdit = !state.dashEdit; renderView(); return; }
    const dMove = e.target.closest("[data-dash-move]");
    if (dMove) { const [key, dir] = dMove.dataset.dashMove.split(":"); moveDash(key, dir); return; }
    const mt = e.target.closest("[data-modal-tipo]");
    if (mt) { setTipo(mt.dataset.modalTipo); return; }
    const rb = e.target.closest("[data-modal-reemb]");
    if (rb) { toggleReemb(); return; }
    const mc = e.target.closest("[data-modal-cat]");
    if (mc) { pickCat(mc.dataset.modalCat); return; }
    const ms = e.target.closest("[data-modal-sub]");
    if (ms) { pickSub(ms.dataset.modalSub); return; }
    const dset = e.target.closest("[data-date-set]");
    if (dset) { state.form.data = isoPlusDays(TODAY_ISO, +dset.dataset.dateSet); renderModal(); return; }
    if (e.target.closest("[data-recon-accept-all]")) { reconAcceptAll(); return; }
    if (e.target.closest("[data-recon-accept-dup]")) { reconAcceptDup(); return; }
    const acc = e.target.closest("[data-recon-accept]");
    if (acc) { reconAccept(acc.dataset.reconAccept); return; }
    const edt = e.target.closest("[data-recon-edit]");
    if (edt) { reconEdit(edt.dataset.reconEdit); return; }
    const ign = e.target.closest("[data-recon-ignore]");
    if (ign) { reconIgnore(ign.dataset.reconIgnore); return; }
    const rea = e.target.closest("[data-recon-reactivate]");
    if (rea) { reconReactivate(rea.dataset.reconReactivate); return; }
    if (e.target.closest("[data-recon-commit]")) { reconCommit(); return; }
    if (e.target.closest("[data-recon-done-x]")) { state.reconDone = null; renderView(); return; }
    if (e.target.closest("[data-recon-add]")) { openReconAdd(); return; }
    if (e.target.closest("[data-recon-plug]")) { reconPlug(); return; }
    const act = e.target.closest("[data-action]");
    if (act && ACTIONS[act.dataset.action]) { ACTIONS[act.dataset.action](); return; }
    // clique fora fecha o menu de conta aberto
    if (state.acctMenu && !e.target.closest(".acct-menu")) { state.acctMenu = null; renderView(); }
  });
  document.addEventListener("input", (e) => {
    const f = e.target.closest("[data-field]");
    if (!f) return;
    let v = f.value;
    if (f.dataset.field === "valor") { const clean = v.replace(/[^0-9.,]/g, ""); if (clean !== v) f.value = clean; v = clean; }
    state.form[f.dataset.field] = v;
    updateSaveEnabled();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (state.pop) closePop();
    else if (state.modal) closeModal();
    else if (state.drill) closeDrill();
    else if (state.acctMenu || state.acctEdit) { state.acctMenu = null; state.acctEdit = null; renderView(); }
  });
  // gráfico de patrimônio: hover (tooltip) + arrastar (mede o período)
  document.addEventListener("mousedown", (e) => {
    const pc = e.target.closest(".pchart"); if (!pc) return;
    e.preventDefault(); pcDrag = { pc, start: pcIdxAt(pc, e.clientX) };
    pcDrawBand(pc, pcDrag.start, pcDrag.start);
  });
  document.addEventListener("mousemove", (e) => {
    if (pcDrag) { pcDrawBand(pcDrag.pc, pcDrag.start, pcIdxAt(pcDrag.pc, e.clientX)); return; }
    const pc = e.target.closest(".pchart"); if (!pc) return;
    pcShow(pc, pcIdxAt(pc, e.clientX));
  });
  document.addEventListener("mouseup", (e) => {
    if (!pcDrag) return;
    const start = pcDrag.start, end = pcIdxAt(pcDrag.pc, e.clientX); pcDrag = null;
    state.pcSel = start !== end ? { a: start, b: end } : null;
    renderView();
  });
  document.addEventListener("mouseout", (e) => {
    if (pcDrag) return;
    const pc = e.target.closest(".pchart");
    if (pc && !(e.relatedTarget && pc.contains(e.relatedTarget))) pcHide(pc);
  });
  document.addEventListener("touchstart", (e) => {
    const pc = e.target.closest(".pchart"); if (!pc) return;
    const t = e.touches[0]; pcDrag = { pc, start: pcIdxAt(pc, t.clientX) };
    pcDrawBand(pc, pcDrag.start, pcDrag.start);
  }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (!pcDrag) return; const t = e.touches[0];
    pcDrawBand(pcDrag.pc, pcDrag.start, pcIdxAt(pcDrag.pc, t.clientX)); e.preventDefault();
  }, { passive: false });
  document.addEventListener("touchend", (e) => {
    if (!pcDrag) return;
    const t = (e.changedTouches && e.changedTouches[0]) || { clientX: 0 };
    const start = pcDrag.start, end = pcIdxAt(pcDrag.pc, t.clientX); pcDrag = null;
    state.pcSel = start !== end ? { a: start, b: end } : null;
    renderView();
  });
  // arrastar-e-soltar dos blocos do dashboard
  document.addEventListener("dragstart", (e) => {
    const row = e.target.closest("[data-dash-row]");
    if (!row) return;
    state.dragKey = row.dataset.dashRow;
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    row.classList.add("dragging");
  });
  document.addEventListener("dragover", (e) => {
    if (!state.dragKey) return;
    const row = e.target.closest("[data-dash-row]");
    if (!row) return;
    e.preventDefault();
    document.querySelectorAll(".dash-edit-row.drop-over").forEach((r) => r.classList.remove("drop-over"));
    if (row.dataset.dashRow !== state.dragKey) row.classList.add("drop-over");
  });
  document.addEventListener("drop", (e) => {
    const row = e.target.closest("[data-dash-row]");
    if (!row || !state.dragKey) return;
    e.preventDefault();
    const from = state.dragKey; state.dragKey = null;
    reorderDash(from, row.dataset.dashRow);
  });
  document.addEventListener("dragend", () => {
    if (state.dragKey !== null) { state.dragKey = null; renderView(); }
    else document.querySelectorAll(".drop-over,.dragging").forEach((r) => r.classList.remove("drop-over", "dragging"));
  });
  // conciliação: enviar arquivo (seleção + arrastar-soltar)
  document.addEventListener("change", (e) => {
    const f = e.target.closest("[data-imp-file]");
    if (f && f.files && f.files.length) { addReconFiles(f.files); f.value = ""; return; }
    const ia = e.target.closest("[data-imp-acct]");
    if (ia) { state.reconAccount = ia.value; return; } // mantém a conta escolhida ao re-renderizar
    const rf = e.target.closest("[data-recon-field]");
    if (rf) { const card = rf.closest("[data-recon-id]"); if (card) reconFieldChange(card.dataset.reconId, rf.dataset.reconField, rf.value); }
  });
  // batimento: a cada tecla guarda o saldo do banco e atualiza SÓ o resultado (não a view toda,
  // senão o input é recriado e perde o foco no meio da digitação)
  document.addEventListener("input", (e) => {
    const rb = e.target.closest("[data-recon-bank]");
    if (rb) { state.reconBank = rb.value; refreshReconDiff(); }
  });
  document.addEventListener("dragover", (e) => { const d = e.target.closest("[data-imp-drop]"); if (d) { e.preventDefault(); d.classList.add("drag"); } });
  document.addEventListener("dragleave", (e) => { const d = e.target.closest("[data-imp-drop]"); if (d && !(e.relatedTarget && d.contains(e.relatedTarget))) d.classList.remove("drag"); });
  document.addEventListener("drop", (e) => {
    const d = e.target.closest("[data-imp-drop]"); if (!d) return;
    e.preventDefault(); d.classList.remove("drag");
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) addReconFiles(files);
  });
}

let _wired = false, _booted = false;
async function init() {
  elView = document.getElementById("view");
  elTitle = document.getElementById("pg-title");
  elSub = document.getElementById("pg-sub");
  elBadge = document.getElementById("nav-badge");
  elModal = document.getElementById("modal-root");
  // listeners de autenticação (a tela de login existe antes do wire() do app)
  document.addEventListener("submit", (e) => {
    if (e.target.closest("[data-auth-form]")) { e.preventDefault(); submitAuth(); return; }
    if (e.target.closest("[data-setpass-form]")) { e.preventDefault(); submitSetPass(); return; }
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-auth-google]")) { e.preventDefault(); loginGoogle(); return; }
    if (e.target.closest("[data-auth-toggle]")) { e.preventDefault(); const em = document.querySelector("[data-auth-email]"); _authState = { view: "signin", mode: _authState.mode === "signup" ? "login" : "signup", email: em ? em.value.trim() : _authState.email, msg: "" }; renderAuth(); return; }
    if (e.target.closest("[data-auth-back]")) { _authState = { view: "signin", mode: "login", email: _authState.email, msg: "" }; renderAuth(); return; }
    if (e.target.closest("[data-setpass]")) { e.preventDefault(); openSetPass(); return; }
    if (e.target.closest("[data-setpass-cancel]")) { e.preventDefault(); hideAuth(); return; }
    if (e.target.closest("[data-signout]")) { if (window.Store) Store.signOut().then(() => location.reload()).catch(() => location.reload()); return; }
  });
  if (!window.Store) { renderAuthError("Falha ao carregar o módulo de dados."); return; }
  try { await Store.init(); } catch (e) { renderAuthError("Sem conexão com o servidor. Tente recarregar."); return; }
  // outra aba (ou o sync) atualizou os dados → recarrega o modelo local e re-renderiza, pra esta
  // aba nunca ficar com estado velho (que poderia sobrescrever/apagar o que a outra aba fez).
  if (Store.onStale) Store.onStale(() => {
    if (!_booted) return;
    // Uma conciliação em andamento (arquivo já importado) é estado TRANSITÓRIO — vive só em `state`,
    // fora do modelo. Recarregar o modelo não muda nada na tela dela, mas re-renderizar destruiria a
    // edição em curso: o input de saldo perde o foco/cursor e um item sendo editado é redesenhado
    // (com outra aba aberta, o BroadcastChannel dispara isso a cada gravação da outra aba, deixando a
    // conciliação impossível de editar). Então: SEMPRE aplica o modelo (pra absorver o que a outra aba
    // fez e não empurrar dado velho no reconCommit — o "push fantasma"), mas só re-renderiza quando
    // não há edição em curso. Mesmo motivo do guard de `state.modal`.
    const busy = state.modal || state.imported;
    Store.loadSnapshot().then((m) => { if (m) { applyModel(m); refreshDataLabels(); if (!busy) renderView(); } }).catch(() => {});
  });
  Store.onAuth((authed) => { if (authed) boot(); else showLogin(); });
  if (Store.isAuthed()) boot(); else showLogin();
}

// reflete o usuário logado na sidebar (nome/e-mail/inicial) — antes era "Henrique" fixo
function updateSidebarUser() {
  const u = window.Store && Store.user; if (!u) return;
  const meta = u.user_metadata || {};
  const nome = meta.full_name || meta.name || (u.email ? u.email.split("@")[0] : "Você");
  const nameEl = document.querySelector(".side-user .u-name");
  const subEl = document.querySelector(".side-user .u-sub");
  const avEl = document.querySelector(".side-user .avatar");
  if (nameEl) nameEl.textContent = nome;
  if (subEl) subEl.textContent = u.email || "conta pessoal";
  if (avEl) avEl.textContent = (nome.trim()[0] || "?").toUpperCase();
}

// começo utilizável para um usuário novo: 2 contas zeradas + categorias comuns (BR). Sem lançamentos.
function defaultSeedModel() {
  const cat = (nome, subs) => ({ nome, subs, total: 0 });
  return {
    accounts: [
      { id: "cc", nome: "Conta Corrente", sub: "Banco", tipo: "banco", saldo: 0, grupo: "fin", arquivada: false, ordem: 0 },
      { id: "cart", nome: "Carteira", sub: "Dinheiro", tipo: "dinheiro", saldo: 0, grupo: "fin", arquivada: false, ordem: 1 },
    ],
    catTree: {
      receita: [
        cat("Salário", ["Salário", "Adiantamento", "13º / Férias"]),
        cat("Renda extra", ["Freelance", "Vendas", "Bonificação"]),
        cat("Rendimentos", ["Juros", "Dividendos"]),
        cat("Outros", ["Reembolsos", "Presentes"]),
      ],
      despesa: [
        cat("Moradia", ["Aluguel", "Condomínio", "Energia", "Água", "Internet"]),
        cat("Alimentação", ["Supermercado", "Restaurante", "Delivery"]),
        cat("Transporte", ["Combustível", "Aplicativos", "Transporte público", "Manutenção"]),
        cat("Saúde", ["Plano de saúde", "Farmácia", "Consultas"]),
        cat("Lazer", ["Streaming", "Bares e restaurantes", "Viagens"]),
        cat("Compras", ["Roupas", "Eletrônicos", "Casa"]),
        cat("Educação", ["Cursos", "Livros"]),
        cat("Outros", ["Taxas e tarifas", "Diversos"]),
      ],
    },
    tx: [], dashOrder: state.dashOrder.slice(), prefs: {},
  };
}

// self-heal: um usuário sem NENHUMA categoria (seed antigo/parcial vindo de código em cache velho)
// não consegue nem lançar transação. Injeta o conjunto padrão e persiste. Idempotente — só age
// quando está realmente vazio; não mexe nas categorias de quem já tem as suas.
function ensureSeeded() {
  if (catTree.receita.length || catTree.despesa.length) return;
  const def = defaultSeedModel();
  catTree.receita.push(...def.catTree.receita.map(cloneCat));
  catTree.despesa.push(...def.catTree.despesa.map(cloneCat));
  if (!accounts.length) def.accounts.forEach((a) => accounts.push(a));
  saveState();
}

// carrega os dados (do IndexedDB; puxa/semeia se preciso) e sobe o app
async function boot() {
  if (_booted) return; _booted = true;
  hideAuth();
  const seedModel = currentModel(); // estado inicial = OF_DATA (local) ou mock; usado só p/ 1º seed
  let model = await Store.loadSnapshot();
  if (!model) {
    // 1º acesso neste aparelho: sem snapshot local, precisamos puxar da nuvem antes de mostrar a tela.
    // Mostra "carregando" pra não exibir o shell vazio (R$ 0,00) durante os segundos do sync.
    renderAuthLoading();
    try { await Store.sync(); } catch (e) { /* offline: segue com o que tiver */ }
    model = await Store.loadSnapshot();
  }
  if (!model) {
    // 1ª vez neste usuário: se o servidor está vazio, semeia um começo utilizável
    // (dados reais locais OF em dev; senão o starter genérico com contas e categorias padrão).
    let remoteEmpty = true;
    try { remoteEmpty = await Store.isRemoteEmpty(); } catch (e) { remoteEmpty = false; }
    if (remoteEmpty) { const starter = OF ? seedModel : defaultSeedModel(); await Store.seed(starter); model = starter; }
    else model = { accounts: [], catTree: { receita: [], despesa: [] }, tx: [], dashOrder: state.dashOrder.slice() };
  }
  applyModel(model);
  ensureSeeded(); // self-heal: injeta categorias/contas padrão se o usuário ficou sem nenhuma
  loadQuotesCache(); loadHistCache(); // cotações e histórico em cache → valor de mercado já sai no 1º render
  refreshDataLabels();
  hideAuth(); // remove o "carregando", se estava
  if (!_wired) { wire(); _wired = true; }
  renderView(); renderModal(); renderPop();
  // cotações frescas em segundo plano (só se houver ativos lançados)
  if (hasHoldings()) { fetchQuotes().then((ok) => { if (ok) { refreshSideNet(); renderView(); } }); fetchHistory().then((ok) => { if (ok) renderView(); }); }
  // pull em segundo plano: se outro aparelho mudou, atualiza a tela
  Store.sync().then((r) => { if (r && r.pulled && r.model) { applyModel(r.model); refreshDataLabels(); renderView(); } }).catch(() => {});
}

function refreshDataLabels() {
  const netEl = document.getElementById("side-net-val");
  if (netEl) netEl.textContent = fmt(netWorth());
  updateSidebarUser();
  // título e seletor de mês refletem o mês real com lançamentos (não "Julho 2026" fixo)
  const ym = refMonthYM();
  const cap = ym ? monthLabel(ym) : "";
  PAGE.dashboard[1] = cap ? `Como está seu dinheiro em ${cap}` : "Suas finanças pessoais";
  if (elSub && state.tab === "dashboard") elSub.textContent = PAGE.dashboard[1];
  const monthEl = document.querySelector(".month");
  if (monthEl && monthEl.childNodes[0]) monthEl.childNodes[0].textContent = (cap ? cap.toLowerCase() : "sem lançamentos") + " ";
  const demo = document.querySelector(".pill-demo");
  if (demo) demo.style.display = "none"; // não é mais "dados de exemplo" — vem do banco
}

/* ---------- tela de login (e-mail + senha; Google desativado por ora) ---------- */
const AUTH_GOOGLE = false; // liga o botão "Entrar com Google" quando o provedor estiver ativo no Supabase
const GOOGLE_SVG = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;
let _authState = { view: "signin", mode: "login", email: "", msg: "" };
function showLogin() { _booted = false; _authState = { view: "signin", mode: "login", email: "", msg: "" }; renderAuth(); }
function hideAuth() { const g = document.getElementById("auth-gate"); if (g) g.innerHTML = ""; }
function renderAuthError(msg) { _authState = { view: "error", mode: "login", email: "", msg }; renderAuth(); }
function renderAuthLoading() {
  const g = document.getElementById("auth-gate"); if (!g) return;
  g.innerHTML = `<div class="auth-overlay"><div class="auth-card"><div class="auth-brand">${ic("wallet", 30)}</div><h2>Carregando seus dados…</h2><p>Sincronizando com a nuvem. No primeiro acesso deste aparelho isso leva alguns segundos.</p><div class="auth-spin"></div></div></div>`;
}
function renderAuth() {
  const g = document.getElementById("auth-gate"); if (!g) return;
  const s = _authState;
  let inner;
  if (s.view === "sent") {
    inner = `<div class="auth-ic">${ic("check", 26)}</div><h2>Confirme seu e-mail</h2>
      <p>Enviamos um link de confirmação para <b>${s.email}</b>. Abra-o para ativar a conta e depois entre com sua senha.</p>
      <button class="auth-btn ghost" data-auth-back>Voltar ao login</button>`;
  } else if (s.view === "error") {
    inner = `<div class="auth-ic err">${ic("circle-alert", 26)}</div><h2>Ops</h2><p>${s.msg}</p>
      <button class="auth-btn" onclick="location.reload()">Recarregar</button>`;
  } else {
    const signup = s.mode === "signup", busy = s.view === "busy";
    const google = AUTH_GOOGLE
      ? `<button class="auth-btn google" data-auth-google>${GOOGLE_SVG}<span>Entrar com Google</span></button><div class="auth-or"><span>ou com seu e-mail</span></div>`
      : "";
    inner = `<div class="auth-brand">${ic("wallet", 30)}</div><h2>Meu Caixa</h2>
      <p>${signup ? "Crie sua conta — seus dados ficam privados e sincronizados entre aparelhos." : "Entre para acessar suas finanças, privadas e sincronizadas entre aparelhos."}</p>
      ${google}
      <form data-auth-form>
        <input type="email" data-auth-email value="${attr(s.email)}" placeholder="voce@email.com" autocomplete="email" required>
        <input type="password" data-auth-pass placeholder="Senha" autocomplete="${signup ? "new-password" : "current-password"}" minlength="6" required>
        <button class="auth-btn" type="submit"${busy ? " disabled" : ""}>${busy ? "Aguarde…" : signup ? "Criar conta" : "Entrar"}</button>
      </form>
      ${s.msg ? `<p class="auth-msg err">${s.msg}</p>` : ""}
      <p class="auth-switch">${signup ? "Já tem conta?" : "Ainda não tem conta?"} <a href="#" data-auth-toggle>${signup ? "Entrar" : "Criar conta"}</a></p>`;
  }
  g.innerHTML = `<div class="auth-overlay"><div class="auth-card">${inner}</div></div>`;
  const inp = g.querySelector(s.email ? "[data-auth-pass]" : "[data-auth-email]"); if (inp) setTimeout(() => inp.focus(), 0);
}
async function loginGoogle() {
  try { const { error } = await Store.signInWithGoogle(); if (error) throw error; /* redireciona pro Google */ }
  catch (e) { _authState = Object.assign({}, _authState, { view: "signin", msg: "Não consegui abrir o login do Google." }); renderAuth(); }
}
async function submitAuth() {
  const em = document.querySelector("[data-auth-email]"), pw = document.querySelector("[data-auth-pass]");
  const email = em ? em.value.trim() : "", password = pw ? pw.value : "";
  const signup = _authState.mode === "signup";
  if (!email || password.length < 6) { _authState = Object.assign({}, _authState, { view: "signin", email, msg: "Informe e-mail e uma senha de 6+ caracteres." }); renderAuth(); return; }
  _authState = { view: "busy", mode: _authState.mode, email, msg: "" }; renderAuth();
  try {
    if (signup) {
      const { data, error } = await Store.signUpPassword(email, password);
      if (error) throw error;
      // sem sessão = projeto exige confirmação por e-mail; com sessão = entra direto (onAuthStateChange → boot)
      if (!data.session) { _authState = { view: "sent", mode: "login", email, msg: "" }; renderAuth(); }
    } else {
      const { error } = await Store.signInPassword(email, password);
      if (error) throw error; // sucesso → onAuthStateChange dispara boot()
    }
  } catch (e) {
    const raw = (e && e.message || "").toLowerCase();
    let msg = signup ? "Não consegui criar a conta. Tente novamente." : "E-mail ou senha incorretos.";
    if (raw.includes("already registered") || raw.includes("already exists")) msg = "Esse e-mail já tem conta. Faça login.";
    else if (raw.includes("not confirmed")) msg = "Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).";
    else if (raw.includes("password")) msg = "Senha muito curta (mínimo 6 caracteres).";
    _authState = { view: "signin", mode: _authState.mode, email, msg }; renderAuth();
  }
}
// definir/alterar senha (usuário já logado) — bootstrap sem depender de e-mail
function openSetPass() { const g = document.getElementById("auth-gate"); if (!g) return;
  g.innerHTML = `<div class="auth-overlay"><div class="auth-card"><div class="auth-brand">${ic("wallet", 26)}</div><h2>Definir senha</h2>
    <p>Escolha uma senha para entrar por e-mail + senha neste e em outros aparelhos.</p>
    <form data-setpass-form>
      <input type="password" data-setpass-pass placeholder="Nova senha (6+ caracteres)" autocomplete="new-password" minlength="6" required>
      <button class="auth-btn" type="submit">Salvar senha</button>
    </form>
    <p class="auth-msg" data-setpass-msg></p>
    <button class="auth-btn ghost" data-setpass-cancel>Cancelar</button></div></div>`;
  const inp = g.querySelector("[data-setpass-pass]"); if (inp) setTimeout(() => inp.focus(), 0);
}
async function submitSetPass() {
  const pw = document.querySelector("[data-setpass-pass]"), msgEl = document.querySelector("[data-setpass-msg]");
  const password = pw ? pw.value : "";
  if (password.length < 6) { if (msgEl) { msgEl.textContent = "A senha precisa ter ao menos 6 caracteres."; msgEl.className = "auth-msg err"; } return; }
  if (msgEl) { msgEl.textContent = "Salvando…"; msgEl.className = "auth-msg"; }
  try { const { error } = await Store.setPassword(password); if (error) throw error;
    if (msgEl) { msgEl.textContent = "Senha definida! Já pode entrar por e-mail + senha."; msgEl.className = "auth-msg ok"; }
    setTimeout(hideAuth, 1400);
  } catch (e) { if (msgEl) { msgEl.textContent = "Não consegui salvar. Tente novamente."; msgEl.className = "auth-msg err"; } }
}
document.addEventListener("DOMContentLoaded", init);
