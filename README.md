# Portfólio — Carlos Mafra

Site estático (HTML + CSS + um pouco de JS), sem build, sem framework. Pensado para
publicar direto no **GitHub Pages**.

## Estrutura

```
index.html            página principal
404.html              página de erro (GitHub Pages usa automaticamente)
.nojekyll             pula o build Jekyll do GitHub Pages (deploy mais rápido, sem surpresas)
assets/
  css/style.css       todo o estilo, com tema claro/escuro por variáveis
  js/main.js          tema, menu mobile, mapa mental (markmap)
  img/favicon.svg     ícone da aba
  img/og.svg          fonte do preview de link
  img/og.png          preview de link 1200x630 (gerado de og.svg)
  cv/                 carlos-mafra-cv.pdf (botão "Baixar CV")
design/               export original do Claude Design (ignorado no git)
```

## Publicar no GitHub Pages

1. `git add . && git commit -m "site"` e `git push` para a branch `master`.
2. No GitHub: **Settings → Pages → Build and deployment**
   - Source: **Deploy from a branch**
   - Branch: **master** / pasta **/ (root)** → **Save**
3. Em ~1 min o site sai em `https://<seu-usuario>.github.io/portfolio/`.

### Caminhos são relativos de propósito

Como o site fica em `.../portfolio/` (subpasta), todos os `href`/`src` usam caminho
relativo (`assets/...`, `./`). Não troque para caminho absoluto (`/assets/...`) — quebra
no Pages. Se um dia usar domínio próprio ou renomear o repo para
`<usuario>.github.io`, aí sim o site vai para a raiz e as URLs absolutas em
`<meta canonical>` / Open Graph precisam ser atualizadas.

## Antes de divulgar — pendências de conteúdo

- [x] **CV**: `assets/cv/carlos-mafra-cv.pdf` no repo; botão "Baixar CV" funciona.
- [x] **Imagem de link (og)**: `og.png` 1200×630 gerado de `og.svg`; `<head>` aponta pra ele.
- [x] **URL canônica**: `carlosmafraa.github.io/portfolio/` no canonical, Open Graph e JSON-LD.
- [ ] **Nível de inglês**: considerar um chip no hero com seu nível (o CV cita "trabalho remoto").
- [ ] **Impacto quantificado**: já tem bastante número do CV; se surgir mais (cobertura de
      testes %, RPS/latência no K6, nº de usuários), dá pra reforçar.
- [x] **GitHub**: bio, empresa, pins e projetos de destaque do perfil atualizados; READMEs de `EasyWarehouse`, `DashBoard` e `API_RESTFUL` caprichados (descricao, stack, como rodar).
- [ ] **Projetos**: se possível, publicar 1–2 projetos pessoais com deploy + repo público.

## Rodar localmente

Qualquer servidor estático, por exemplo:

```
npx serve .
# ou
python -m http.server
```

Abrir `http://localhost:3000` (ou `:8000`).
