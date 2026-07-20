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
  do Supabase por **diff** (push = upsert do que mudou; pull = linhas com `updated_at > cursor`;
  deleções = tombstone na coluna `deleted`; resolução **last-write-wins** por `updated_at` carimbado no
  servidor). Single-user em vários aparelhos → sem conflito entre pessoas.
- **`app.js`** — o app usa o modelo em memória (`accounts` / `catTree` / `state.tx` / `state.dashOrder`).
  `currentModel()`/`applyModel()` fazem a ponte; `store.js` converte modelo⇄linhas (`_modelToRows`/
  `_rowsToModel`) e faz o diff. Categorias têm **ids determinísticos por nome** (`c|tipo|nome`,
  `c|tipo|pai|sub`) — renomear = id novo + tombstone do velho. Transações referenciam cat/sub/conta
  **por nome** (coluna do banco é `descricao`, não `desc`).
- **Login** magic-link (`Store.signIn(email)`), sessão persistida pelo supabase-js. `init()` → gate de
  auth; `boot()` carrega do IndexedDB (ou puxa/semeia) e sobe o app. Botão "sair" na sidebar.
- **PWA**: `manifest.json` + `sw.js` (shell offline: network-first no HTML, stale-while-revalidate nos
  assets; Supabase passa direto pela rede). Ícones em `icons/` (carteira brass 192/512).

## Supabase (projeto `meucaixa`)
- ref/project_id: **`umvtbondcihigdltspub`** · região sa-east-1 · URL `https://umvtbondcihigdltspub.supabase.co`
- Publishable key (no `store.js`, **pública por design** — o RLS protege): `sb_publishable_Yw6ISMmrN_ovWPbfIEpt-w_hPauW78Y`
- Tabelas: `accounts`, `categories` (hierárquica via `parent_id`), `transactions`, `prefs` (jsonb).
  Todas com `user_id uuid default auth.uid()`, `updated_at` (trigger `set_updated_at`), `deleted`,
  índice `(user_id, updated_at)` e **RLS** `for all using/with check (user_id = auth.uid())`.
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
`.assetsignore` enxuga o site. **Auto-deploy no push** via `.github/workflows/deploy.yml` (já commitado,
usa `cloudflare/wrangler-action`, accountId `b7345f757a0fc365da5dcdea7a033db5`): só falta o repo ter o
secret **`CLOUDFLARE_API_TOKEN`** (token do template *Cloudflare Pages — Edit*) para os runs passarem.

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
- Testes com **jsdom** (no scratchpad, com `fake-indexeddb` e um Supabase stub). Limitação conhecida:
  `const state`/`accounts`/`catTree` são de escopo de módulo e **não** são acessíveis via `window.eval`
  — verifique pelo DOM ou pelas funções globais.

## Mapa de arquivos
`index.html` (shell + scripts) · `app.js` (toda a lógica/telas) · `store.js` (persistência+sync) ·
`styles.css` · `vendor/supabase.js` (UMD vendorizado) · `manifest.json` + `sw.js` + `icons/` (PWA) ·
`gerar_dados.py`→`dados.js` (seed local, gitignored).
