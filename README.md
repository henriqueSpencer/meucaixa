# MeuCaixa

App de controle financeiro pessoal — SPA em HTML/CSS/JS puro, sem build.

## Telas
- **Visão geral** — patrimônio, receitas × despesas, despesas por categoria e evolução do patrimônio. Página personalizável (arraste os blocos) e drill-down por mês/categoria no gráfico.
- **Contas** — saldos por conta e alocações de patrimônio; clique numa conta para ver os lançamentos, editar o nome, reordenar ou arquivar.
- **Transações** — receitas, despesas, transferências e reembolsos, com filtros.
- **Conciliação** — importar extrato e confirmar as sugestões.
- **Categorias** — estrutura de receitas e despesas.

## Lançar transação
Modal com valor em destaque, tipo (despesa / receita / transferência), reembolso como opção dentro de receita, categoria em grade de ícones e subcategoria.

## Rodar localmente
```bash
cd meucaixa
python3 -m http.server 5173
# abra http://127.0.0.1:5173
```

Os dados de exemplo ficam embutidos no `app.js`. Para visualizar uma base própria,
gere um `dados.js` expondo `window.OF_DATA` no mesmo formato (contas, categorias,
transações e agregados) — o app usa esses dados quando presentes e cai no exemplo
quando não. `dados.js` não é versionado (dados pessoais).
