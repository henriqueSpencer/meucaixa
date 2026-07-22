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
- **Telas (`VIEWS`/`PAGE`, aba via `data-tab`)**: `dashboard`, `contas`, `transacoes`, `conciliacao`,
  `categorias`, `historico` (audit git-like), `config` (Configurações). Nova aba = entrada em `VIEWS` +
  `PAGE` + botão `data-tab` no `index.html` (as funções `view*` são globais).
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
- Tabelas: `accounts`, `categories` (hierárquica via `parent_id`), `transactions`, `prefs` (jsonb).
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
  `window.eval` (mas `function view*`/`Store` sim) — verifique pelo DOM ou chamando as funções globais.

## Importar extrato (tela Conciliação)
Lê **OFX/CSV/TXT** (`parseOFX`/`parseCSV`, texto) e **PDF** do **Mercado Pago** (`parsePDF`→`mpParsePage`
em `app.js`). O PDF é lido por **coordenadas** via **pdf.js** (vendorizado em `vendor/pdf.min.js` +
`vendor/pdf.worker.min.js`, carregado sob demanda por `import()` dinâmico; `workerSrc` aponta pro
`.js`). Cada transação é ancorada na **coluna "Valor"** (bandas de x do template MP: Data `x<85`,
Descrição `85–190`, Valor `270–348`, Saldo `≥348`); data e descrição multilinha casam com a âncora
mais próxima em y. Não depende de cabeçalho (só a pág. 1 tem). Validação: soma dos movimentos bate com
Entradas−Saídas do extrato. **Não há mais "extrato de exemplo"** — sem arquivo lido, o botão fica
desabilitado (removidos `initialRecon` e o fallback no action `import`).

## Mapa de arquivos
`index.html` (shell + scripts) · `app.js` (toda a lógica/telas) · `store.js` (persistência+sync) ·
`styles.css` · `vendor/supabase.js` (UMD vendorizado) · `vendor/pdf.min.js` + `vendor/pdf.worker.min.js`
(pdf.js, leitura de PDF na importação) · `manifest.json` + `sw.js` + `icons/` (PWA) ·
`gerar_dados.py`→`dados.js` (seed local, gitignored).
