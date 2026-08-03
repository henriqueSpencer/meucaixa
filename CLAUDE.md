# MeuCaixa — instruções para o Claude

App de **controle financeiro pessoal** (single-user). SPA em **HTML/CSS/JS puro, sem build**.
No ar em **https://meucaixa.pages.dev**. Repo **público** `henriqueSpencer/meucaixa`.

## Como rodar local
```bash
cd ~/Documents/Investimentos/meu_caixa && python3 -m http.server 5173   # → http://127.0.0.1:5173
```
Precisa de internet + login (magic-link). O app **exige autenticação** antes de mostrar qualquer dado.
Cache-busting: `styles.css`/`app.js`/`store.js` usam `?v=N` no `index.html` — **bump o N ao editar**,
senão o navegador serve a versão antiga. (`vendor/supabase.js` não tem versão; é fixo.)
**Se precisar da Pages Function** (`/api/history/*`, usada só pelo gráfico "Carteira a mercado"), o
`python3 -m http.server` NÃO a serve — use `wrangler pages dev`:
```bash
DIST=$(mktemp -d); git archive HEAD | tar -x -C "$DIST"; npx wrangler@latest pages dev "$DIST" --port 5173
```
⚠️ o `wrangler pages dev` serve uma **cópia congelada** (`git archive`), não os arquivos ao vivo — ao
editar, **reconstrua o DIST e reinicie**. Pro resto do app (inclusive importar da B3, que roda pdf.js no
navegador) o `python3 -m http.server` basta e reflete edições na hora.

## Arquitetura (produção)
Frontend estático no **Cloudflare Pages** (CDN, sem cold start) falando **direto com o Supabase**
(sem servidor próprio). Persistência **offline-first**:
- **`store.js`** — `window.Store`. IndexedDB é a **fonte da verdade local**; sincroniza com o Postgres
  do Supabase. **`sync()` = PULL primeiro, depois MERGE 3-vias, depois PUSH** (ordem importa!): puxa as
  linhas com `updated_at > cursor`, reconstrói o estado remoto e faz um **merge por linha** entre `base`
  (último servidor confirmado = `lastSynced`), `local` (snapshot) e `remote`. Uma linha só é **empurrada**
  quando difere da base (edição/inclusão/exclusão minha genuína) **E** o servidor NÃO a alterou; se o
  servidor mudou, o **remoto vence** (inclui conflito). Deleções = tombstone na coluna `deleted`. Isso
  substituiu o antigo *push-antes-de-pull* que empurrava valor local obsoleto por cima de um mais novo do
  servidor com `updated_at` sempre fresco no upsert — o **"push fantasma"** que revertia dados no reload
  sem o usuário ter editado nada (bug real: Loft `alocado 40000→37000`). O cursor **não** avança além dos
  próprios writes (re-puxá-los é benigno; avançar poderia pular uma mudança concorrente de outro aparelho).
  Lógica pura e testável: `_mergeRows`/`_modelToRows`/`_rowsToModel`. **Multi-usuário**: cada conta só vê
  seus dados (RLS `user_id = auth.uid()`); o upsert usa
  `onConflict: "user_id,id"`. **PK é composta `(user_id, id)`** em todas as tabelas (migração
  `composite_pk_per_user`) — sem isso, os ids determinísticos de categoria (`c|tipo|nome`) colidiriam
  entre usuários numa PK global. O FK self de `categories` (parent) também é composto `(user_id, parent_id)`.
  **Robustez do sync (aprendido na marra):** (1) o pull **pagina** com `.range()` (`selectAll`) — o
  PostgREST corta em 1000 linhas/req, e sem paginar um aparelho novo baixava só 1000 das N transações;
  (2) **cache por-usuário**: `loadSnapshot` descarta o snapshot se o `uid` gravado ≠ usuário logado,
  `saveSnapshot` carimba o `uid`, `signOut` limpa — senão, ao trocar de conta no mesmo navegador o novo
  usuário via os dados do anterior (era só local; o servidor sempre isolou via RLS); (3) **guarda
  anti-corrida**: se o snapshot local mudou durante o sync (edição não-enviada, ex.: arquivar), NÃO aplica
  o merge nem avança o cursor — compara a **forma canônica** (`modelToRows`, não o modelo cru, senão um
  re-save benigno dá falso-positivo e atrasa dados novos) e reconcilia no próximo ciclo; (4) **`SYNC_VERSION`** (const no `store.js`):
  bump força descartar snapshot/cursor/lastSynced e re-puxar tudo (usado quando um bug de sync exige
  limpar o cache de todos). Testes desses casos ficam em node (fake-indexeddb + stub Supabase).
- **`app.js`** — o app usa o modelo em memória (`accounts` / `catTree` / `state.tx` / `state.dashOrder`).
  `currentModel()`/`applyModel()` fazem a ponte; `store.js` converte modelo⇄linhas (`_modelToRows`/
  `_rowsToModel`) e faz o diff. Categorias têm **ids determinísticos por nome** (`c|tipo|nome`,
  `c|tipo|pai|sub`) — renomear = id novo + tombstone do velho. Transações referenciam cat/sub/conta
  **por nome** (coluna do banco é `descricao`, não `desc`).
- **Login**: **e-mail + senha** (`Store.signInPassword`/`signUpPassword`; tela com toggle Entrar⇄Criar
  conta). Cliente supabase-js com `flowType:"pkce"` + `detectSessionInUrl`. `init()` → gate de auth
  (`renderAuth`); `boot()` carrega do IndexedDB (ou puxa/semeia) e sobe o app. A sidebar mostra o usuário
  logado (`Store.user`, via `updateSidebarUser`) + botões **"definir senha"** (ícone chave,
  `Store.setPassword`→`updateUser`, bootstrap sem e-mail p/ contas criadas por link mágico) e "sair".
  Código de **Google OAuth** (`Store.signInWithGoogle`, PKCE) está pronto mas **desativado** pelo flag
  `AUTH_GOOGLE=false` no `app.js` — pra ligar: ativar provedor no Supabase (Google Cloud OAuth Client Web
  + redirect `.../auth/v1/callback`; Providers → Google com client id/secret) e virar o flag. Magic-link
  (`Store.signIn`) segue no `store.js` como recurso de recuperação, fora da UI.
  Obs.: p/ signup sem fricção de e-mail, desligar "Confirm email" no Supabase Auth (senão o app mostra
  "Confirme seu e-mail" após criar conta).
- **Onboarding de usuário novo**: se o servidor está vazio (0 contas, `isRemoteEmpty` checa `accounts`),
  `boot()` semeia `defaultSeedModel()` — 2 contas zeradas (Conta Corrente, Carteira) + categorias comuns
  BR, sem lançamentos. Além disso, `ensureSeeded()` (no boot, após `applyModel`) faz **self-heal**: se o
  usuário ficou **sem nenhuma categoria** (seed parcial / código antigo em cache), injeta o conjunto
  padrão e persiste — senão não dá nem pra lançar transação. Usuário com dados nunca cai nesses caminhos.
- **Telas (`VIEWS`/`PAGE`, aba via `data-tab`)**: `dashboard`, `patrimonial` (cockpit de investimentos),
  `contas`, `transacoes`, `conciliacao`, `categorias`, `historico` (audit git-like), `config`
  (Configurações). Nova aba = entrada em `VIEWS` + `PAGE` + botão `data-tab` no `index.html` (as funções
  `view*` são globais). Duas telas **tomam a área de conteúdo fora do sistema de abas** (como o detalhe de
  conta): `viewAcctDetail` (quando `state.acctDetail`) e `viewAssetRecon` (quando `state.assetRecon`) — o
  `renderView` checa esses states antes de cair no `VIEWS[state.tab]`.
- **Configurações (`viewConfig`)**: perfil (nome editável via `Store.updateName`→`user_metadata.full_name`;
  e-mail read-only), segurança (alterar senha, reusa `data-setpass`), seus dados (resumo + `exportBackup`
  = download JSON do `currentModel`), aparência (tema segue o sistema), sessão (sair) + versão (`APP_VERSION`).
- **Dados reais, sem mock**: dashboard/Extrato/gráficos calculam das transações reais. `refMonthYM()` =
  último mês com receita/despesa (pula meses só-transferência); título/seletor de mês refletem ele.
  `TODAY_ISO` = data real de hoje (era fixa). Totais das categorias vêm de `catTotals()` (as linhas do
  banco têm `total:0`). Sem lançamentos → zero/vazio (não os antigos 15.800/8.900). Os `const` mock
  (`monthly`/`receitasMes`/etc.) só sobrevivem como fallback do modo dev com `OF_DATA`.
- **PWA**: `manifest.json` + `sw.js` (shell offline: network-first no HTML, stale-while-revalidate nos
  assets; Supabase passa direto pela rede). Ícones em `icons/` (carteira brass 192/512). **Favicon**: o
  Safari ignorava SVG/PNG externo → usa **SVG inline (data-URI)** no `<link rel=icon>` do `index.html`
  (padrão que funciona, igual ao DIVYVAL) + **`/favicon.ico`** na raiz (16/32/48, gerado com Pillow).

## Supabase (projeto `meucaixa`)
- ref/project_id: **`umvtbondcihigdltspub`** · região sa-east-1 · URL `https://umvtbondcihigdltspub.supabase.co`
- Publishable key (no `store.js`, **pública por design** — o RLS protege): `sb_publishable_Yw6ISMmrN_ovWPbfIEpt-w_hPauW78Y`
- Tabelas: `accounts`, `categories` (hierárquica via `parent_id`), `transactions`, `prefs` (jsonb),
  **`asset_moves`** (ledger de compra/venda/provento de ativos — ver seção Investimentos).
  Todas com `user_id uuid default auth.uid()`, `updated_at` (trigger `set_updated_at`), `deleted`,
  índice `(user_id, updated_at)` e **RLS** `for all using/with check (user_id = auth.uid())`.
- **`audit_log`** (append-only, migração `audit_log`): histórico de alterações. Gatilhos `zaudit_*`
  (`after insert/update/delete`) em accounts/categories/transactions chamam `log_change()`
  (**SECURITY DEFINER**) que grava `action` (insert/update/delete — tombstone `deleted=true` vira
  'delete'), `old_data`/`new_data` (jsonb), `label` e `changed_at`. Ignora update que só mexeu em
  `updated_at`. RLS só-select por usuário. Alimenta a aba **Histórico** (`fetchAudit`→`viewHistorico`,
  diff git-like agrupado por dia). Registra a partir de agora — não reconstrói edições passadas.
- Administrável pelo MCP do Supabase nesta máquina (`list_tables`/`execute_sql`/`apply_migration`).
- **Login de produção** exige, no painel (Authentication → URL Configuration): Site URL
  `https://meucaixa.pages.dev` e Redirect URL `https://meucaixa.pages.dev/**`.

## Deploy
Cloudflare Pages, projeto `meucaixa` (**direct-upload via wrangler**; o token OAuth local já tem escopo
`pages`). **Publique só arquivos versionados** (o `wrangler pages deploy` NÃO respeita `.gitignore`):
```bash
DIST=$(mktemp -d); git archive HEAD | tar -x -C "$DIST"
npx --yes wrangler@latest pages deploy "$DIST" --project-name=meucaixa --branch=main --commit-dirty=true
```
`.assetsignore` enxuga o site. **Deploy é MANUAL por enquanto** (comando acima) — a produção atualiza a
cada mudança. **Auto-deploy no push** via `.github/workflows/deploy.yml` (wrangler-action, accountId
`b7345f757a0fc365da5dcdea7a033db5`) está pronto mas **falta o secret `CLOUDFLARE_API_TOKEN`**; enquanto
não existe, o workflow **pula sem falhar** (checa o token num step e só publica se houver) — assim não
spamma email de erro. Quando o secret entrar (o **usuário** configura — criar/guardar credencial não é
tarefa do assistente; o OAuth local do wrangler não serve pro action), o Actions assume o deploy sozinho.

## Dados reais (seed já feito)
Vieram do `base.bak` (export SQLite do **Orçamento Fácil**). `gerar_dados.py` → `dados.js`
(`window.OF_DATA`). O seed já rodou: o Supabase tem 23 contas, 50 categorias, 2706 transações. O
`index.html` **não carrega mais** `dados.js` (app lê do banco). Para re-semear do zero, re-adicione a
tag e limpe as tabelas.

## Convenções que SEMPRE importam
- **`state.tx` é sempre ordenado por data desc** (`sortTx()`, chamado em `applyModel`/`saveTx`/
  `reconCommit`). As linhas voltam do banco na ordem de `updated_at` (com empates = ordem física da
  tabela), então sem ordenar a aba Transações mostrava 300 lançamentos arbitrários dizendo serem "os
  mais recentes" e "Últimas transações" no dashboard mostrava lançamentos velhos. Se criar outro
  caminho que insere em `state.tx`, chame `sortTx()`.
- **`ordem` da conta é o que persiste** (`rowsToModel` ordena por ele). Mexer só na posição do array
  `accounts` não grava nada — chame `reindexAccounts()` (feito em `moveAcct`/`saveAcctForm`).
- **`fmt`/`fmtNum`/`fmtShort` toleram valor ausente** (`numOr0`): um campo nulo não pode derrubar a
  view inteira (uma conta de patrimônio sem `alocado` deixava a aba Contas em branco).
- **Texto do usuário dentro de atributo HTML passa por `attr()`** (`value="${attr(x)}"`); no corpo do
  Histórico use `_esc`. Descrição/nome com aspas quebrava o input do modal.
- **Reembolso** (`tipo:"reembolso"`) é um **crédito lançado numa categoria de DESPESA** (valor positivo,
  cat/sub de despesa — o modal usa `catTree.despesa` quando `reembolso`). Em **toda** visão de despesa ele
  **abate o total** (net), nunca soma: totais (`byCat`, `catTotals`, `monthFlow`), séries e listas
  (`viewCatDetail`, popup `catTx`) usam `contrib = reembolso ? -abs : +abs` e o filtro de despesa é
  `t.tipo === "despesa" || t.tipo === "reembolso"` (nunca `=== "despesa"` sozinho). Na UI aparece como
  crédito (`+`, cor positiva, tag "reembolso"). Ao criar qualquer lista/total de categoria, replique isso.
- **Nunca** versionar/publicar dado financeiro: `base.bak`, `dados.js`, `gerar_dados.py`, `imagens/`,
  `.wrangler/` são **gitignored**. Ao deployar, use o `git archive` (nunca `deploy .` da pasta suja).
- Commits em **português**, estilo enxuto, prefixo `MeuCaixa:`, **sem trailers automáticos de co-autoria**;
  conta **henriqueSpencer**.
- Mount points de modais (`#modal-root`/`#drill-root`/`#pop-root`/`#auth-gate`) ficam **dentro de
  `.fin-root`** (os tokens de cor são escopados ali; fora disso os pop-ups ficam invisíveis).
- **Testar SEM navegador** (preferência do usuário — automação de browser gasta muito token/é lenta;
  navegador só em último caso). Ordem: (1) `node --check`; (2) **node/jsdom** no scratchpad com
  `fake-indexeddb` + stub do Supabase — dá pra carregar `store.js`/`app.js` e chamar as funções globais
  (`viewConfig()` etc.) ou dirigir o `sync()` injetando a corrida pelo stub; (3) **SQL via MCP do
  Supabase** pra checar o efeito real no banco (ex.: `arquivada` das contas, contagem por usuário).
  Limitação do jsdom: `const state`/`accounts`/`catTree`/`VIEWS` são de escopo léxico e **não** vêm via
  `window.eval` **quando o app.js é injetado com `window.eval(fonte)`**. O jeito que funciona: jsdom com
  `runScripts:"dangerously"`, carregar o `index.html` sem as tags de `vendor/supabase.js`+`store.js`,
  pôr um `window.Store` stub (`init/onAuth/onStale/isAuthed/loadSnapshot/saveSnapshot/sync/
  isRemoteEmpty/seed/fetchAudit/user`) e appendar o `app.js` como `<script>` inline — aí
  `win.eval("state.tx")` e `win.eval("moveAcct('c5','up')")` funcionam e dá pra dirigir a UI de verdade
  (`<input type=file>` com `Object.defineProperty(inp,"files",…)` + `dispatchEvent(new Event("change"))`).

## Investimentos (carteira de ativos) — EM PRODUÇÃO
Contas `tipo:"invest"` (carteiras/corretoras) registram **ativos** — ações/ETF/FII/renda fixa — em vez de
lançar valorização à mão. A parte de ativos vive **dentro da página da própria conta** (`invAtivosSection`
no `viewAcctDetail`), não numa aba separada. Decisões de design do usuário: valorização a mercado **não** é
fluxo de caixa (só patrimônio); adicionar ativo = **lançamento** (data/ticker/qtd/preço) e o **preço médio
é derivado** (custo médio ponderado). Cotação atual via **brapi** `quote/list` (CORS liberado, sem token,
cache em localStorage `mc_quotes`); histórico mensal via a Pages Function `/api/history` (Yahoo).

- **Ledger `asset_moves`** (Supabase, RLS/PK-composta/audit/sync como as outras): cada linha é um movimento
  `{contaId, iso, ticker, nome, classe, tipo, qtd, preco}`. `tipo` ∈ `compra`/`venda`/**`provento`**. Não há
  coluna `valor`: **provento e renda-fixa-lump** são guardados como `qtd:1, preco:<valor>` (sem migração de
  schema — a coluna `tipo` não tem CHECK). No `store.js` roda no diff/merge junto com as demais tabelas.
- **Posição derivada** (`computePositions(contaId)`): custo médio ponderado; venda reduz pelo PM e realiza
  ganho; **provento** só acumula `o.proventos` (não mexe em qtd/custo). Retorna `pm` (PM sem proventos),
  `pmProv` ((custo−proventos)/qtd), `investido` (=custo), `valor`, `ganho`/`ganhoPct` (s/ prov),
  `ganhoProv`/`ganhoProvPct` (c/ prov), `isRF`, `valorManual`. A tabela de ativos mostra Qtd·PM·Investido·
  Cotação·Valor·Proventos·Result. s/ prov·Result. c/ prov (scroll horizontal). **Clicar num ativo expande
  inline** (`state.invExpand["contaId|TICKER"]`, `invPosDetailRow`) as movimentações que o formam +
  Comprar mais/Vender/Lançar provento/Classificar/Excluir ativo. Excluir (ativo inteiro ou 1 movimento)
  **pede confirmação** (`confirmAssetDel`/`confirmMoveDel`).
- **Conta = CAIXA + INVESTIDO** (nada sobrescreve `a.saldo`; tudo derivado ao vivo): `carteiraCaixa` =
  saldo + `invCashDelta` (compra sai −, venda/provento entram +); `invInvestido` = Σ valor de mercado;
  `acctTotal` = caixa + investido → alimenta `netWorth`. O extrato inclui compra/venda/provento como linhas
  de caixa (`acctAssetRow`); o cabeçalho e cada mês mostram **caixa · aplicado (custo) · mercado · total**.
  (Um approach antigo que sobrescrevia o saldo com o valor de mercado — `recomputeInvestBalances` — foi
  REMOVIDO; se reaparecer em cache é código velho.)
- **Renda fixa** (CDB/LCI/Tesouro; classe `rf`/`caixa`, `semCotacaoClasse`): sem cotação de bolsa. Aporte =
  compra, resgate = venda; o **valor atual é manual** (marcação), guardado em `prefs.rfValores["contaId|TICKER"]`
  (`rfValor`/`setRfValor`, pop "Atualizar valor"). Mostra "—" em qtd/PM/cotação. **Nuance:** a "Renda Fixa"
  da B3 (LFTB11 etc.) vem COM quantidade → o import a classifica como **`etf`** (ativo com qtd), não como RF-
  lump; o agrupamento "renda fixa" fica no **objetivo/liquidez** (independente da classe).
- **Classificação por ticker** (`prefs.assetTags[TICKER] = {objetivo,setor,segmento}`; `assetTag`/`setAssetTag`,
  objetivo default pela classe): objetivo/liquidez (Caixa, RF curto/longo, Ações, FIIs, Exterior…) é
  **ortogonal à classe** (um ETF pode ser "Caixa"). Alimenta a **pizza de composição** (`carteiraComposicao(dim)`
  + `pieSVG` donut puro) na Visão patrimonial, dimensões classe/objetivo/setor/segmento (`state.compDim`).
- **Visão patrimonial** (`viewPatrimonial`, aba `patrimonial`): líquido/bruto/passivos, alocação por classe
  (atual vs meta editável), composição (pizza), evolução por snapshots ("Registrar mês"), carteira a mercado
  reconstruída do histórico (`heldAt`/`investedMarketAt` × `PRICE_HIST`), proventos 12m (de `asset_moves`
  provento; fallback: receita marcada dividendo/rendimento), rentabilidade real vs IPCA/CDI. Metas/snapshots/
  premissas/tags/rfValores ficam todos em **`prefs`** (sincronizado via currentModel/applyModel).
- **Pages Function `functions/api/history/[ticker].js`**: 1ª peça de servidor no MeuCaixa (antes era estático
  puro + Supabase). Proxy do histórico mensal de fechamento do Yahoo (CORS liberado, cache no edge 6h) porque
  o navegador não alcança o Yahoo direto e a brapi passou a cobrar token. Deploy leva junto (Cloudflare Pages
  suporta Functions); rodar local exige `wrangler pages dev` (ver "Como rodar local").

### Importar da B3 → tela de conciliação de ativos (com de-para instituição→conta)
Vive na **aba Conciliação** (`viewConciliacao`, card `.b3-zone` "Importar investimentos da B3", botão
`data-b3-import`→`b3ImportPick()`), **não** dentro de uma conta — o arquivo da B3 traz **várias corretoras**
(coluna "Instituição"), então não faz sentido escolher uma conta só. `b3ImportPick` **não recebe contaId**.
(A seção Ativos da conta tem só um atalho de navegação `data-goto-b3import` que leva pra aba Conciliação —
não é um 2º fluxo.) Lê **PDF** (`.pdf`) **e Excel** (`.xlsx`); `parseB3File(file)` roteia por extensão: `.xlsx`
→ `readXlsx`+`b3ParseMovXlsx`; senão → `parseB3PDF`.
**De-para instituição→conta** (o coração do fluxo): `b3Broker(inst)` canonicaliza o nome da corretora
(agrupa variações: "BANCO BTG PACTUAL S/A." / "S.A." → "BTG Pactual"; "XP INVESTIMENTOS CCTVM" / "CORRETORA
DE CAMBIO" → "XP"; mapa de keywords `B3_BROKERS` + fallback limpando sufixos legais). `openAssetRecon(kind,
fileName, moves)` monta os brokers distintos e o mapa `brokerMap` **pré-preenchido** por semelhança de nome
(`b3AcctForBroker`: conta invest cujo `b3Broker(nome)` bate). No `viewAssetRecon`, o cabeçalho mostra o de-para
(um `<select data-ar-map>` por corretora: contas invest + "(não importar)" + **"+ criar carteira"** = `__new__`,
que chama `createInvestAccount(broker)` na hora). Cada **linha** (`r.broker`, `r.contaId` = `brokerMap[broker]`)
vai pra conta mapeada; sem conta → linha **travada** (Aceitar desabilitado, tag "mapeie a corretora"). Trocar o
mapa re-deduplica só aquele broker (`assetReconDedupAll(broker)` — dedup por-linha contra os `asset_moves` da
**conta destino da linha**). `assetReconCommit` distribui os aceitos em **múltiplas contas** (`contaId: r.contaId`).
A validação "Como as carteiras ficam" (`assetReconProjByConta`) mostra **um bloco por conta** mapeada (4 totais +
posição por ativo). A **lista é agrupada por corretora** (`state.arCollapsed`/`state.arPage`): cada grupo colapsa
(`assetReconToggleGroup`), **pagina 30 cards** por vez (`assetReconMoreGroup` — evita renderizar centenas) e tem
**"Aceitar todos desta corretora"** (`assetReconAcceptBroker`). Validado (jsdom, arquivo real): 614 movs → 5
corretoras, prefill casou 3 por nome, XP criou carteira na hora, Rico mapeado numa conta existente, commit
distribuiu 251/196/108/59 em 4 contas, 0 órfãos; agrupar cortou o HTML de 1,23M→315K chars.
**Provento guarda a QUANTIDADE de ativos que o gerou** (`provStore(valor, shares)`): em vez de `qtd:1,
preco:valor`, guarda `qtd:<cotas>, preco:valor/qtd` — assim `qtd×preco` reproduz o valor **líquido** recebido
(no JCP o "preço unitário" da B3 é bruto, antes do IR de 15%, então derivamos do valor líquido) **e** a
quantidade fica visível (card, extrato do ativo, lista de lançamentos mostram "N cotas"). Sem qtd no arquivo
(PDF, ou coluna vazia) → `qtd:1`. Todo o cálculo de valor já usava `qtd×preco`, então a mudança é transparente.
**Renda fixa direta É importada** (`b3Produto` retorna `{ticker, nome, isRF}`): 1) ativo listado (ticker B3);
2) RF codificada — produto `TIPO - CÓDIGO - Emissor` com `TIPO` ∈ `B3_RF_PREFIX` (CDB/RDB/LCI/LCA/CRA/CRI/DEB/
DPGE/…) → ticker = o CÓDIGO, `classe:"rf"`; 3) RF sem código (Tesouro Direto) → ticker = o nome. **Opções**
("Opção de Compra - …") e o resto → ticker "" (ignorado). `b3MovClass` mapeia `Aplicação`→compra,
`Resgate`/`Resgate Antecipado`/`Vencimento`→venda, `Amortização`/`Pagamento de Juros`→provento. RF entra como
compra/venda com qtd×preço (custo) — o **valor atual segue manual** (marcação à mão, `prefs.rfValores`); o card
da conciliação mostra "Aporte/Resgate". `Vencimento` costuma vir com `valor=0` → o guard "trade só com qtd E
preço>0" **pula** (o papel não zera sozinho; ajuste à mão). **Limitação**: resgate cujo aporte ficou fora do
período (ou em outra corretora) gera posição/negativo — o painel "como as carteiras ficam" mostra isso pra
conferência. ETFs de RF com ticker (ex.: LFTB11) seguem entrando como ETF/FII (têm cotação), não como RF-manual.
- **Excel do relatório de Movimentação (`b3ParseMovXlsx`) é a FONTE COMPLETA** e o caminho preferido: traz
  todo o histórico de compra/venda **+** proventos com colunas estruturadas (Entrada/Saída, Data, Movimentação,
  Produto, Quantidade, Preço unitário, Valor). `b3MovClass(mov, es)` classifica o tipo do movimento
  (Dividendo/Rendimento/JCP/"Pagamento de Juros"/Reembolso/"Leilão de Fração" = **provento**, sinal por
  Crédito/Débito, "- Cancelado" reverte, ignora "- Transferido"; Compra/Venda e "COMPRA/VENDA"/"Transferência -
  Liquidação" = **trade**, direção pela coluna **Entrada/Saída** Crédito=compra Débito=venda). `b3Produto`
  extrai `ticker`+`nome` do "CÓDIGO - Nome" (RF/Tesouro sem código de negociação → sem ticker → ignorado; RF é
  marcada à mão no app). Trade só entra com qtd **e** preço (custódia/empréstimo/subscrição/bonificação vêm sem
  preço = `-` → ignorados). Validado no arquivo real: 1392 linhas → **104 compras + 34 vendas + 476 proventos**.
- **`readXlsx` é um leitor .xlsx puro, SEM lib** (`xlsxUnzip` lê o central-directory do zip, `xlsxInflateRaw`
  usa `DecompressionStream('deflate-raw')`, o XML de `sharedStrings`+`sheet1` é lido por regex, não DOMParser —
  roda igual em browser e node). 1ª peça que descompacta zip no app.
- **PDFs** (pdf.js já vendorizado): `b3ParseNegPage` (Extrato de **Negociação** → compra/venda, linha única,
  parse da direita: 2 últimos R$ = preço/valor, qtd, ticker=último código-de-negociação) e `b3ParseMovPage`
  (Extrato de **Movimentação** → proventos + trades com rótulo **explícito** Compra/Venda; multi-linha, âncora
  no valor da coluna direita x≥500 + tipo/ticker/qtd/preço por proximidade em y). ⚠️ **O PDF de Movimentação NÃO
  traz a coluna Entrada/Saída** (a direção é cor, não texto), então "Transferência - Liquidação" (a maioria das
  compras/vendas de ações) fica **sem direção e é ignorada no PDF** — por isso o Excel é o caminho completo.
  `parseB3PDF` detecta o tipo pela pág.1 (`b3Kind`). Depois abre a **tela `viewAssetRecon`** (`state.assetRecon`, take-over da área
de conteúdo) — **espelha a conciliação de extrato**: cards editáveis (`assetReconCard`, campos `data-arf`),
aceitar/ignorar/reativar (`assetReconAccept`/`Ignore`/`Reactivate`/`AcceptAll`), dedup contra os
`asset_moves` da conta (`assetImportDedup` → o que já existe nasce "ignorado"), trocar carteira re-deduplica
(`assetReconSetConta`). **Validação de saldo**: painel "Como a carteira fica" com **caixa · aplicado · mercado
· total projetados** (`assetReconProjTotals` injeta os aceitos no ledger, calcula com a mesma lógica da conta
e desfaz — não vaza) + **posição por ativo** (`assetReconProjected`, atual→projetada). `assetReconCommit`
cria os aceitos como `asset_moves` (com `nome` preenchido a partir do Excel). Validado nos arquivos reais do
usuário: Negociação PDF 34 trades, Movimentação PDF 320 proventos, **Movimentação Excel 138 trades + 476
proventos** (a fonte completa). Formatos de fora: **Negociação em Excel** (colunas diferentes — sem `Produto`;
cai no "não reconheci"), Nota de corretagem e CSV — dá pra somar depois. Os arquivos de exemplo em `arq_exemplo/`
são **gitignored** (têm CPF/dados reais; PDFs e `*.xlsx`). **Testar sem browser:** o Excel roda em node
direto (node 18+ tem `DecompressionStream`/`TextDecoder`) — extraia o bloco de helpers B3 do `app.js` real e
`eval` com stubs de `parseValor`/`numOr0`, aí chame `readXlsx`+`b3ParseMovXlsx` contra o `.xlsx` real; pdf.js
roda em node com `global.self=global` + `GlobalWorkerOptions.workerSrc` no `.min.js` (passe os text-items
`{str,x,y}` pros `b3Parse*`). Ver `xlsx_proto.js`/`classify_test.js` no scratchpad.

## Importar extrato (tela Conciliação)
Lê **OFX/CSV/TXT** (`parseOFX`/`parseCSV`, texto) e **PDF** do **Mercado Pago** (`parsePDF`→`mpParsePage`
em `app.js`). O PDF é lido por **coordenadas** via **pdf.js** (vendorizado em `vendor/pdf.min.js` +
`vendor/pdf.worker.min.js`, carregado sob demanda por `import()` dinâmico; `workerSrc` aponta pro
`.js`). Cada transação é ancorada na **coluna "Valor"** (bandas de x do template MP: Data `x<85`,
Descrição `85–190`, Valor `270–348`, Saldo `≥348`); data e descrição multilinha casam com a âncora
mais próxima em y. Não depende de cabeçalho (só a pág. 1 tem). Validação: soma dos movimentos bate com
Entradas−Saídas do extrato. **Não há mais "extrato de exemplo"** — sem arquivo lido, o botão fica
desabilitado (removidos `initialRecon` e o fallback no action `import`).

**Status dos itens e saldo projetado** (`buildRecon`/`viewConciliacao`): cada item tem `status`
(`pendente`/`conciliado`/`ignorado`). `findReconMatch(p, used)` (restrito à conta selecionada,
`state.reconAccount`) detecta correspondência com um lançamento já existente — item correspondente
**já vem `ignorado` (X) por padrão** (`if (match) status = "ignorado"` no `buildRecon`), aparece com tag
"Ignorado" + botão *reativar*. O `used` é obrigatório: **um lançamento existente só casa com UM item do
extrato** — sem isso, duas compras idênticas no arquivo casavam ambas com o mesmo lançamento e a segunda
(nova de verdade) era engolida. Parcelas `n>1` nascem ignoradas com `pulado:true` (o total já entrou na 1ª).
**Pagamento de fatura** (cartão, `isPay`) vira transferência e **também procura `match`** — antes não
procurava e reimportar o extrato duplicava o pagamento; a origem sugerida é a 1ª conta financeira não-cartão
(antes era a string `"Pagamento"`, uma conta inexistente: o saldo entrava no cartão sem sair de lugar nenhum).
**Reimportar um extrato já lançado tem que funcionar** (pedido explícito do usuário). O ✕ automático é
só a proteção padrão — a decisão é do usuário. Por isso: (a) `reconCommit` cria **todos** os aceitos
(antes filtrava `novos = aceitos.filter(!r.match)`, então aceitar um item correspondente não criava nada
e reimportar era **impossível por qualquer caminho** — era esse o bug); (b) o banner `.recon-dup`
("Este extrato já foi importado") diz quantos já existem e o período deles, com o botão **"Importar mesmo
assim os N já existentes"** (`reconAcceptDup`, que **não** reativa as parcelas `pulado:true` — essas
lançariam o valor em dobro de verdade); (c) o resumo `.recon-sum` mostra "N lidos · X novos · Y já
existiam · Z parcelas puladas"; (d) botão **"Aceitar N pendentes"** (`reconAcceptAll`) evita clicar item
a item. O rótulo do salvar conta **todos** os aceitos (`conc`), não só os sem correspondência. O **saldo projetado** conta **todos os
itens não-ignorados** (`contam = recon.filter(r => r.status !== "ignorado")`, soma `reconEffect`); só o X
tira do cálculo, então **reativar/aceitar** um correspondente faz ele voltar a somar (pedido do usuário).
Consequência: reativar um correspondente soma no projetado por cima do saldo
que já o reflete (o projetado vira "total dos ativos", não previsão exata do saldo pós-save) — comportamento
pedido explicitamente.

**Batimento com o banco** (`.recon-check`, card logo abaixo do `recon-head`): o usuário digita em
**"Saldo no banco"** (`state.reconBank`, texto cru) o saldo que está vendo no app do banco e o MeuCaixa
mostra **`banco − saldo projetado`**; **zero ⇒ "Bate na vírgula"**, senão mostra a diferença assinada + o
lado que falta lançar (diff > 0 = falta entrada; diff < 0 = falta despesa). Peças: `parseSaldo` (aceita
`1.234,56`, `1234,56`, `1234.56`, `R$ …`, negativo com `-` ou parênteses; `null` = vazio/inválido),
`reconTotals()` (extraído da view justamente pra poder recalcular fora dela). O campo também aceita
**continhas** (`100+50`, `1.234,56-30`, `(100+50)*2`, `3x4`) — `parseSaldo` detecta operador e delega a
`evalArith`, um avaliador aritmético **sem `eval`/`Function`** (descida recursiva, `+ − * /` e parênteses,
`null` em expressão malformada); número puro segue no caminho BR de sempre. Também `reconDiff`/`reconDiffHTML`
e `refreshReconDiff`. O listener de `input` **não chama `renderView()`** — patcha só o `[data-recon-diff]`,
senão o input é recriado a cada tecla e perde foco/cursor. O valor sobrevive aos re-renders porque a view
lê de `state.reconBank`; zera no `import`/`reimport`/`reconCommit`. No commit, `reconCommit` guarda o
batimento **pós-save** em `state.reconDone.bat` (saldo real da conta já com os lançamentos criados vs.
banco) e o banner verde diz se bateu ou quanto ainda falta.

**Lançar a diferença (plug)** (`reconPlug`, botão `.rc-plug` dentro de `[data-recon-diff]`): quando há
diferença, aparece um botão que cria um **lançamento de ajuste do valor exato da diferença** como item
**pendente** (aceitar/editar/ignorar, igual aos do extrato). `valor = diff` (positivo ⇒ **receita**,
negativo ⇒ **despesa**), categoria default = a 1ª do tipo (editável antes de aceitar), `raw = "Ajuste de
saldo (conciliação)"`, `manual:true, ajuste:true`. Como o item entra no projetado, a diferença **zera na
hora** e o botão some (self-limiting — não dá pra criar dois). O botão vive dentro do bloco patchado por
`refreshReconDiff`, mas o clique funciona por delegação (`data-recon-plug`).

**Conciliação é estado transitório × sync entre abas** (bug real): a sessão de conciliação (`state.recon`,
`state.imported`, `state.reconBank`, `state.editing`) vive só em `state`, fora do modelo salvo. O handler
`onStale` (app.js `init`) dispara a cada gravação de **outra aba** (via `BroadcastChannel`) e a cada sync;
antes ele **re-renderizava** a tela — o que, durante a conciliação, matava o foco do input de saldo e
redesenhava o item em edição, deixando a aba "impossível de editar" com uma segunda aba aberta. Correção:
o `onStale` **sempre aplica o modelo novo** (`applyModel`, pra absorver o que a outra aba fez e não empurrar
dado velho no `reconCommit` — o "push fantasma"), mas **só re-renderiza quando não há edição em curso**
(`busy = state.modal || state.imported`). Ações do próprio usuário (aceitar/ignorar/editar) seguem
re-renderizando normalmente — o guard é só no callback de stale.

**Prosseguir sem arquivo** (`recon-empty`): na tela de importação, além do CTA de importar, há o link
**"Prosseguir sem arquivo"** — entra na conciliação com `state.recon = []` (mesmo destino do `import`,
sem extrato lido), pra usar o **batimento de saldo** e/ou **lançar à mão** (`data-recon-add`). Quando
`nLidos === 0` (nenhum extrato lido), a barra troca "N lançamentos lidos"/"0 de 0 conciliados" por
"Conferência de saldo · sem arquivo" + texto próprio, e o botão "Reimportar" vira "Importar arquivo".

## Mapa de arquivos
`index.html` (shell + scripts) · `app.js` (toda a lógica/telas) · `store.js` (persistência+sync) ·
`styles.css` · `vendor/supabase.js` (UMD vendorizado) · `vendor/pdf.min.js` + `vendor/pdf.worker.min.js`
(pdf.js, leitura de PDF na importação — extrato Mercado Pago **e** B3) ·
`functions/api/history/[ticker].js` (Pages Function serverless: histórico de cotação p/ a Visão
patrimonial) · `manifest.json` + `sw.js` + `icons/` (PWA) · `gerar_dados.py`→`dados.js` (seed local,
gitignored) · `arq_exemplo/` + `*.xlsx` (PDFs/planilhas de extrato com dados reais — **gitignored**).
