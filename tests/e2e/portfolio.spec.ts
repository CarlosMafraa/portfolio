import { test, expect, type Page } from "@playwright/test";

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1366) <= 900;

/** Rola até o elemento para disparar as animações de entrada. */
async function scrollTo(page: Page, selector: string) {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
}

test.describe("carregamento", () => {
  test("abre sem erros de console e com título e meta corretos", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

    await page.goto("/");
    await expect(page).toHaveTitle("Carlos Mafra");
    await expect(page.locator("h1")).toHaveText("Desenvolvedor Full Stack");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /full stack/i);
    await expect(page.locator("html")).toHaveClass(/reveal-ready/);
    expect(errors).toEqual([]);
  });

  test("todos os assets locais respondem 200", async ({ page, request }) => {
    await page.goto("/");
    const urls = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("link[href], script[src], a[href], img[src]")]
        .map((el) => el.getAttribute("href") ?? el.getAttribute("src") ?? "")
        .filter((u) => u && !u.startsWith("http") && !u.startsWith("#") && !u.startsWith("tel:") && u !== "./")
    );
    expect(urls.length).toBeGreaterThan(2);
    for (const u of new Set(urls)) {
      const res = await request.get(u);
      expect(res.status(), u).toBe(200);
    }
  });

  test("não tem rolagem horizontal", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("marca", () => {
  test("logo CM no header e no hero, sem 'arquitetura' ou 'design'", async ({ page }) => {
    await page.goto("/");
    const brand = page.getByRole("link", { name: "Início: Carlos Mafra" });
    await expect(brand).toBeVisible();
    await expect(brand.locator("svg.brand__mark")).toBeVisible();
    await expect(page.locator(".logo-stage__mark")).toBeVisible();
    await expect(page.locator(".lockup__role")).toHaveText(/Desenvolvedor\s*\|\s*Full Stack/);

    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).not.toContain("arquitetura |");
    expect(body).not.toMatch(/arquitetura\s*\|\s*design/);
  });

  test("sem localização nem 'disponível para remoto' na página", async ({ page }) => {
    await page.goto("/");
    const chips = page.locator(".chips li");
    await expect(chips).toHaveCount(2);
    await expect(chips.filter({ hasText: /Foxconn/ })).toHaveCount(0);
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/Manaus/i);
    expect(body).not.toMatch(/remoto/i);
  });

  test("texto sem primeira pessoa (crio, faço, desenvolvo…)", async ({ page }) => {
    await page.goto("/");
    const body = await page.locator("main").innerText();
    // \b do JS não trata "ç" como letra; por isso a fronteira é feita com \p{L}
    expect(body).not.toMatch(/(^|[^\p{L}])(crio|faço|fiz|desenvolvo|desenvolvi|escrevo|sou o|sou formado|gosto|estive|troquei)(?!\p{L})/iu);
  });

  test("botão principal usa o cobre da paleta", async ({ page }) => {
    await page.goto("/");
    const cta = isMobile(page) ? page.locator(".contato__actions .btn--solid") : page.locator(".site-header .btn--solid");
    const bg = await cta.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toContain("linear-gradient");
    // tons de cobre: vermelho > verde > azul
    const [r, g, b] = bg.match(/rgb\((\d+), (\d+), (\d+)\)/)!.slice(1).map(Number);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });

  test("animação de traço da logo termina desenhada", async ({ page }) => {
    await page.goto("/");
    const path = page.locator(".logo-stage__mark .logo__draw").first();
    await expect.poll(() => path.evaluate((el) => parseFloat(getComputedStyle(el).strokeDashoffset)), { timeout: 12000 }).toBe(0);
  });

  test("favicon é a logo nova", async ({ request }) => {
    const svg = await (await request.get("assets/img/favicon.svg")).text();
    expect(svg).toContain("A46 46");
  });

  test("todos os ícones declarados existem, no tipo e tamanho certos", async ({ page, request }) => {
    for (const path of ["/", "/pagina-que-nao-existe"]) {
      await page.goto(path);
      const links = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]')]
          .map((l) => ({ href: l.getAttribute("href")!, sizes: l.getAttribute("sizes"), type: l.getAttribute("type") }))
      );
      expect(links.length, path).toBeGreaterThanOrEqual(5);
      // Google exige ao menos um ícone com lado múltiplo de 48px
      expect(links.some((l) => l.sizes && parseInt(l.sizes) % 48 === 0), path).toBe(true);
      for (const l of links) {
        const res = await request.get(l.href);
        expect(res.status(), l.href).toBe(200);
        const body = await res.body();
        if (l.href.includes(".png")) {
          expect(body.subarray(1, 4).toString(), l.href).toBe("PNG");
          const w = body.readUInt32BE(16), h = body.readUInt32BE(20);
          expect(w, l.href).toBe(h);
          if (l.sizes) expect(`${w}x${h}`, l.href).toBe(l.sizes);
        }
        if (l.href.includes(".ico")) {
          expect(body.readUInt16LE(2)).toBe(1);               // tipo: ícone
          const n = body.readUInt16LE(4);
          const sizes = [...Array(n)].map((_, i) => body.readUInt8(6 + 16 * i));
          expect(sizes).toEqual([16, 32, 48]);
        }
      }
    }
  });

  test("favicons sem fundo; só os atalhos de tela inicial têm fundo claro da logo", async ({ page }) => {
    await page.goto("/");
    const corner = (src: string) => page.evaluate(async (src) => {
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data);
    }, src);
    for (const f of ["favicon-16", "favicon-32", "favicon-48", "favicon-96", "favicon-144", "icon-192", "icon-512"]) {
      expect((await corner(`assets/img/icons/${f}.png`))[3], f).toBe(0);
    }
    for (const f of ["apple-touch-icon", "icon-maskable-512"]) {
      expect(await corner(`assets/img/icons/${f}.png`), f).toEqual([244, 243, 239, 255]); // #f4f3ef
    }
    const svg = await (await page.request.get("assets/img/favicon.svg")).text();
    expect(svg).toContain("#2b2e33");   // meia-lua grafite
    expect(svg).toContain("#d9a066");   // cobre da logo
  });

  test("ícone da aba: sem fundo no tema claro, fundo claro da logo no tema escuro", async ({ page }) => {
    // pixel perto do canto (12%,12%): fora da logo, dentro do quadradinho arredondado
    const corner = async (scheme: "light" | "dark") => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setContent(`<body style="margin:0;background:rgb(0,0,255)"><img src="http://localhost:4173/assets/img/favicon.svg?t=${scheme}" width="100" height="100"></body>`);
      await page.locator("img").evaluate((img: HTMLImageElement) => img.decode());
      const shot = await page.locator("img").screenshot();
      return page.evaluate(async (b64) => {
        const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
        const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
        const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0);
        return Array.from(ctx.getImageData(Math.floor(img.width * .12), Math.floor(img.height * .12), 1, 1).data).slice(0, 3);
      }, shot.toString("base64"));
    };
    expect(await corner("light")).toEqual([0, 0, 255]);        // transparente: aparece o azul de trás
    expect(await corner("dark")).toEqual([244, 243, 239]);     // #f4f3ef
  });

  test("manifest válido com ícones 192 e 512", async ({ page, request }) => {
    await page.goto("/");
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    const manifest = await (await request.get(href!)).json();
    expect(manifest.name).toBe("Carlos Mafra");
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    for (const icon of manifest.icons) {
      const res = await request.get(icon.src);
      expect(res.status(), icon.src).toBe(200);
      const body = await res.body();
      expect(`${body.readUInt32BE(16)}x${body.readUInt32BE(20)}`, icon.src).toBe(icon.sizes);
    }
  });

  test("logo.svg renderiza sem erro de XML e sem 'arquitetura'", async ({ page }) => {
    await page.goto("/assets/img/logo.svg");
    await expect(page.locator("parsererror")).toHaveCount(0);
    const text = await page.locator("svg").first().textContent();
    expect(text).toMatch(/DESENVOLVEDOR\s*\|\s*FULL STACK/);
    expect(text?.toLowerCase()).not.toContain("arquitetura");
  });
});

test.describe("hero", () => {
  test("terminal digita comandos", async ({ page }) => {
    await page.goto("/");
    const typer = page.locator(".typer");
    const first = await typer.textContent();
    await expect.poll(async () => (await typer.textContent()) !== first, { timeout: 6000 }).toBe(true);
  });

  test("canvas da rede é desenhado", async ({ page }) => {
    await page.goto("/");
    const canvas = page.locator(".hero__net");
    await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.width), { timeout: 10000 }).toBeGreaterThan(0);
    await expect
      .poll(() =>
        canvas.evaluate((c: HTMLCanvasElement) => {
          const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
          for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
          return false;
        }), { timeout: 10000 })
      .toBe(true);
  });

  test("links externos abrem em nova aba com rel=noopener", async ({ page }) => {
    await page.goto("/");
    const ext = page.locator('a[href^="http"]');
    const n = await ext.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      await expect(ext.nth(i)).toHaveAttribute("target", "_blank");
      await expect(ext.nth(i)).toHaveAttribute("rel", /noopener/);
    }
  });

  test("botão Baixar CV aponta para o PDF", async ({ page, request }) => {
    await page.goto("/");
    const cv = page.getByRole("link", { name: /Baixar CV/ });
    await expect(cv).toHaveAttribute("download", "");
    const res = await request.get((await cv.getAttribute("href"))!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("pdf");
  });
});

test.describe("animações de scroll", () => {
  test("seções aparecem ao rolar", async ({ page }) => {
    await page.goto("/");
    const project = page.locator(".project").last();
    await expect(project).not.toHaveClass(/is-visible/);
    await project.scrollIntoViewIfNeeded();
    await expect(project).toHaveClass(/is-visible/);
    await expect.poll(() => project.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  });

  test("contadores das métricas chegam ao valor final", async ({ page }) => {
    await page.goto("/");
    await scrollTo(page, ".metrics");
    const nums = page.locator(".metric__num");
    await expect(nums).toHaveText(["4", "60", "20", "4"], { timeout: 5000 });
  });

  test("rótulo de seção termina com o texto original após o efeito decrypt", async ({ page }) => {
    await page.goto("/");
    await scrollTo(page, "#projetos");
    await expect(page.locator("#projetos-title")).toHaveText("Projetos em destaque");
    const kicker = page.locator("#projetos .section__kicker");
    await expect(kicker).toHaveText("projetos/", { timeout: 4000 });
    await expect(kicker).not.toHaveAttribute("aria-label");
  });

  test("barra de progresso acompanha a rolagem e o header ganha sombra", async ({ page }) => {
    await page.goto("/");
    const bar = page.locator(".scroll-progress");
    const p = () => bar.evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue("--p") || "0"));
    expect(await p()).toBe(0);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(p).toBeGreaterThan(0.95);
    await expect(page.locator(".site-header")).toHaveClass(/is-scrolled/);
  });
});

test.describe("navegação", () => {
  test("menu leva às seções e o scrollspy marca a atual", async ({ page }) => {
    await page.goto("/");
    if (isMobile(page)) await page.getByRole("button", { name: "Abrir menu" }).click();
    await page.locator("#nav-primary").getByRole("link", { name: "Projetos" }).click();
    await expect(page).toHaveURL(/#projetos$/);
    await expect(page.locator("#projetos")).toBeInViewport();
    await expect(page.locator('#nav-primary a[href="#projetos"]')).toHaveAttribute("aria-current", "location", { timeout: 4000 });
  });

  test("menu mobile abre, fecha no Esc e ao clicar num link", async ({ page }) => {
    test.skip(!isMobile(page), "só no mobile");
    await page.goto("/");
    const toggle = page.locator(".nav-toggle");
    const sobre = page.locator("#nav-primary").getByRole("link", { name: "Sobre" });

    await expect(sobre).not.toBeInViewport();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(sobre).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();
    await sobre.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page).toHaveURL(/#sobre$/);
  });

  test("clicar na logo volta ao topo rápido", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(2000);
    await expect(page.getByRole("link", { name: "Início: Carlos Mafra" })).toBeVisible();
    // mede só a rolagem, dentro da página (sem o atraso do próprio Playwright pra clicar)
    const ms = await page.evaluate(() => new Promise<number>((resolve) => {
      const t0 = performance.now();
      document.querySelector<HTMLAnchorElement>(".brand")!.click();
      (function check() {
        if (window.scrollY === 0) resolve(performance.now() - t0);
        else requestAnimationFrame(check);
      })();
    }));
    // a animação dura no máx. 650ms; o limite tem folga pra máquina carregada (testes em paralelo)
    // e ainda pega o problema original (a rolagem nativa "smooth" levava vários segundos)
    expect(ms).toBeLessThan(3000);
  });

  test("rolar por conta própria logo após o clique não é puxado de volta", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(2000);
    await page.evaluate(() => new Promise<void>((resolve) => {
      document.querySelector<HTMLAnchorElement>(".brand")!.click();
      (function check() { if (window.scrollY === 0) resolve(); else requestAnimationFrame(check); })();
    }));
    // rola na mesma hora em que chegou no topo
    await page.evaluate(() => window.scrollTo(0, 3000));
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.scrollY)).toBe(3000);
  });

  test("item clicado no menu é o que fica destacado (inclusive em tela grande)", async ({ browser }) => {
    test.skip(test.info().project.name === "mobile", "o menu do celular fica recolhido");
    test.slow(); // 2 telas x 6 cliques: com a máquina carregada passa dos 30s padrão
    for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
      const page = await browser.newPage({ viewport: vp });
      await page.goto("/");
      for (const [id, nome] of [["sobre", "Sobre"], ["carreira", "Carreira"], ["habilidades", "Habilidades"], ["projetos", "Projetos"], ["formacao", "Formação"], ["contato", "Contato"]]) {
        await page.locator("#nav-primary").getByRole("link", { name: nome }).click();
        await expect(page).toHaveURL(new RegExp(`#${id}$`));
        await expect(page.locator("#nav-primary a[aria-current]"), `${vp.width}: ${nome}`).toHaveText(nome);
      }
      await page.close();
    }
  });

  test("menu para no título da seção, sem faixa vazia em cima", async ({ page }) => {
    for (const [id, nome] of [["carreira", "Carreira"], ["projetos", "Projetos"], ["formacao", "Formação"]]) {
      await page.goto("/");
      if (isMobile(page)) await page.locator(".nav-toggle").click();
      await page.locator("#nav-primary").getByRole("link", { name: nome }).click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      // mede a posição final: o título ainda pode estar na animação de entrada (sobe 22px)
      const gap = () => page.evaluate((id) => {
        const head = document.querySelector(`#${id} .section__head`)!.getBoundingClientRect().top;
        const header = document.querySelector(".site-header")!.getBoundingClientRect().bottom;
        return head - header;
      }, id);
      await expect.poll(gap, { message: id }).toBeLessThan(48);
      expect(await gap(), id).toBeGreaterThanOrEqual(0);
    }
  });

  test("skip link leva ao conteúdo", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Pular para o conteúdo" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
  });
});

test.describe("tema", () => {
  test("alterna claro/escuro e persiste após recarregar", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const html = page.locator("html");
    const toggle = page.locator(".theme-toggle");
    await expect(html).toHaveAttribute("data-theme", "light");

    await toggle.click();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
    expect(accent).toBe("#e6a46c");

    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");

    await toggle.click();
    await expect(html).toHaveAttribute("data-theme", "light");
  });

  test("segue o sistema quando não há escolha salva", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});

test.describe("carreira (trace)", () => {
  test("Foxconn encerrado em 09/2026 e nada marcado como atual", async ({ page }) => {
    await page.goto("/");
    const fox = page.locator("details.span").first();
    await expect(fox.locator(".span__when")).toHaveText("05/2025 → 09/2026");
    await expect(page.locator(".trace__meta")).toContainText("52 meses");
    expect(await page.locator("main").innerText()).not.toMatch(/→ atual|2025 → atual/);
    await expect(fox.locator(".span__body li").first()).toContainText("Desenvolveu");
  });

  test("lista do cargo ocupa a largura do card", async ({ page }) => {
    await page.goto("/");
    const fox = page.locator("details.span").first();
    await fox.scrollIntoViewIfNeeded();
    // a lista vai até a borda direita do card (descontado só o padding de ~20px)
    const [ul, body] = await Promise.all([fox.locator(".span__body ul").boundingBox(), fox.locator(".span__body").boundingBox()]);
    expect(body!.x + body!.width - (ul!.x + ul!.width)).toBeLessThan(28);
  });

  test("spans abrem e fecham com animação", async ({ page }) => {
    await page.goto("/");
    await scrollTo(page, ".trace");
    const spans = page.locator("details.span");
    await expect(spans).toHaveCount(4);
    await expect(spans.first()).toHaveAttribute("open", "");

    const second = spans.nth(1);
    await second.locator("summary").click();
    await expect(second).toHaveAttribute("open", "");
    await expect(second.locator(".span__body")).toContainText("Taurus");
    await expect(second).not.toHaveAttribute("data-anim", { timeout: 2000 });

    await second.locator("summary").click();
    await expect(second).not.toHaveAttribute("open", { timeout: 2000 });
  });

  test("barras do trace crescem até a largura real", async ({ page }) => {
    test.skip(isMobile(page), "barras escondidas no mobile");
    await page.goto("/");
    await scrollTo(page, ".trace");
    await expect(page.locator(".trace")).toHaveClass(/is-visible/);
    const bar = page.locator(".span__bar i").first();
    await expect
      .poll(async () => bar.evaluate((el) => el.getBoundingClientRect().width / el.parentElement!.getBoundingClientRect().width), { timeout: 4000 })
      .toBeGreaterThan(0.28);
  });
});

test.describe("mapa de habilidades", () => {
  test("no celular mostra a grade de cards e não monta o mapa", async ({ page }) => {
    test.skip(!isMobile(page), "só no mobile");
    await page.goto("/");
    await expect(page.locator(".skillmap-win")).toBeHidden();
    await expect(page.locator(".skillmap > svg")).toHaveCount(0);
    const groups = page.locator(".skills .skills__group");
    await expect(groups).toHaveCount(8);
    await groups.first().scrollIntoViewIfNeeded();
    await expect(groups.first()).toBeVisible();
    await expect(groups.first()).toContainText("Angular");
  });

  test("renderiza e troca de nível", async ({ page }) => {
    test.skip(isMobile(page), "mapa só no desktop");
    await page.goto("/");
    await expect(page.locator(".skills")).toBeHidden();
    await scrollTo(page, ".skillmap");
    const svg = page.locator(".skillmap > svg");
    await expect(svg).toBeVisible({ timeout: 15000 });
    await expect(svg).toContainText("Frontend");

    const nodes = () => svg.locator("g.markmap-node").count();
    await expect.poll(nodes).toBeGreaterThan(5);
    const level2 = await nodes();

    // sem arrastar e sem zoom (não rouba a rolagem)
    await expect(page.getByRole("button", { name: "Ajustar" })).toHaveCount(0);
    const before = await svg.locator("g").first().getAttribute("transform");
    const box = (await svg.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 150, box.y + box.height / 2 + 80, { steps: 5 });
    await page.mouse.up();
    expect(await svg.locator("g").first().getAttribute("transform")).toBe(before);

    const all = page.getByRole("button", { name: "Tudo" });
    await all.click();
    await expect(all).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Nível 2" })).toHaveAttribute("aria-pressed", "false");
    await expect.poll(nodes).toBeGreaterThan(level2);
  });
});

test.describe("acessibilidade de movimento", () => {
  test.use({ reducedMotion: "reduce" });

  test("com reduced-motion tudo já aparece no estado final", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".project").last()).toHaveClass(/is-visible/);
    await expect(page.locator(".metric__num")).toHaveText(["4", "60", "20", "4"]);
    await expect(page.locator(".typer")).toHaveText("ng build --configuration production");
    const canvasW = await page.locator(".hero__net").evaluate((c: HTMLCanvasElement) => c.width);
    expect(canvasW).toBe(300); // tamanho padrão: o canvas nunca foi inicializado
  });
});

test.describe("sem JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("o conteúdo fica visível e a lista de habilidades aparece", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    const op = await page.locator(".project").first().evaluate((el) => getComputedStyle(el).opacity);
    expect(op).toBe("1");
    await expect(page.locator(".skills__group").first()).toBeVisible();
  });
});

test.describe("textos", () => {
  test("contato fala com quem tem uma ideia, não pede vaga", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#contato-title")).toHaveText("Tem uma ideia guardada? Vamos tirar do papel.");
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/vaga/i);
    await expect(page.locator(".site-header .btn--solid")).toContainText("Tenho uma ideia");
  });

  test("sem travessão nos textos", async ({ page }) => {
    await page.goto("/");
    const txt = await page.locator("body").innerText();
    expect(txt).not.toContain("—");
    expect(await page.title()).not.toContain("—");
  });

  test("textos do Sobre no mesmo tamanho", async ({ page }) => {
    await page.goto("/");
    const [a, b] = await Promise.all([
      page.locator(".prose-lead").evaluate((el) => getComputedStyle(el).fontSize),
      page.locator(".prose-dim").evaluate((el) => getComputedStyle(el).fontSize),
    ]);
    expect(a).toBe(b);
  });

  test("contato por WhatsApp no lugar do número", async ({ page }) => {
    await page.goto("/");
    const zap = page.locator(".contato__actions").getByRole("link", { name: /Contar minha ideia/ });
    await expect(zap).toHaveAttribute("href", /^https:\/\/wa\.me\/5592985276297\?text=/);
    await expect(zap).toHaveAttribute("target", "_blank");
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
    expect(await page.locator("body").innerText()).not.toContain("8527-6297");
  });
});

test.describe("layout responsivo", () => {
  test("textos corridos justificados", async ({ page }) => {
    await page.goto("/");
    for (const sel of [".hero__lead", ".prose-lead", ".prose-dim", ".section__intro", ".project__desc", ".pcard__body > p"]) {
      await expect(page.locator(sel).first(), sel).toHaveCSS("text-align", "justify");
    }
    await expect(page.locator("h1")).not.toHaveCSS("text-align", "justify");
    // nenhuma palavra quebrada com hífen automático
    const auto = await page.evaluate(() =>
      [...document.querySelectorAll("body *")].filter((el) => getComputedStyle(el).hyphens === "auto").length
    );
    expect(auto).toBe(0);
  });

  test("título em duas linhas sem quebrar 'Full Stack' e marca numa linha", async ({ page }) => {
    for (const w of [390, 768, 1024, 1366, 1920]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto("/");
      const grad = page.locator(".hero__title .grad");
      const lines = await grad.evaluate((el) => el.getClientRects().length);
      expect(lines, `largura ${w}`).toBe(1);
      const brand = await page.locator(".brand__name").evaluate((el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).fontSize));
      expect(brand, `marca em ${w}`).toBeLessThan(1.6);
    }
  });

  test("hero ocupa a tela inteira no desktop", async ({ page }) => {
    test.skip(isMobile(page), "no celular o hero segue o conteúdo");
    await page.goto("/");
    const [hero, header, vh] = await page.evaluate(() => [
      document.querySelector(".hero")!.getBoundingClientRect().height,
      document.querySelector(".site-header")!.getBoundingClientRect().height,
      window.innerHeight,
    ]);
    expect(hero + header).toBeGreaterThanOrEqual(vh - 4);
  });
});

test.describe("telas grandes", () => {
  for (const [w, h] of [[1920, 1080], [2560, 1440]] as const) {
    test(`conteúdo e fontes crescem em ${w}x${h}`, async ({ browser }) => {
      test.skip(test.info().project.name === "mobile", "teste de monitor grande; roda só no projeto desktop");
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.goto("/");
      const m = await page.evaluate(() => ({
        wrap: document.querySelector(".hero .wrap")!.getBoundingClientRect().width,
        h1: parseFloat(getComputedStyle(document.querySelector("h1")!).fontSize),
        body: parseFloat(getComputedStyle(document.body).fontSize),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        hero: document.querySelector(".hero")!.getBoundingClientRect().height,
      }));
      expect(m.wrap / w).toBeGreaterThan(0.66);   // antes: 1180px fixos (61% em 1920, 46% em 2560)
      expect(m.h1).toBeGreaterThan(70);            // antes: 60px fixos
      expect(m.body).toBeGreaterThan(16.5);
      expect(m.overflow).toBeLessThanOrEqual(0);
      expect(m.hero).toBeGreaterThan(h * 0.85);
      await page.close();
    });
  }
});

test.describe("habilidades extras", () => {
  test("práticas e cursos complementares em quadro", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Boas práticas" })).toBeAttached();
    await expect(page.getByText("Base de engenharia")).toHaveCount(0);
    const courses = page.locator(".practice--courses .courses li");
    await expect(courses).toHaveCount(5);
    await courses.first().scrollIntoViewIfNeeded();
    // cursos ocupam a largura toda, abaixo das duas práticas
    const [a, c] = await Promise.all([page.locator(".practice").first().boundingBox(), page.locator(".practice--courses").boundingBox()]);
    expect(c!.y).toBeGreaterThan(a!.y + a!.height - 1);
    expect(c!.width).toBeGreaterThan(a!.width * 1.5 - (isMobile(page) ? a!.width : 0));
  });

  test("nome da logo do hero fica numa linha só", async ({ page }) => {
    await page.goto("/");
    const name = page.locator(".lockup__name");
    const lines = await name.evaluate((el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).fontSize));
    expect(lines).toBeLessThan(1.6);
  });
});

test.describe("projetos", () => {
  test("projetos pessoais têm print, link do site no ar e do repositório", async ({ page }) => {
    await page.goto("/");
    for (const [name, slug] of [["Pokédex", "pokedex"], ["PDF Cleaner", "pdf-cleaner"]]) {
      const card = page.locator(".pcard", { has: page.getByRole("heading", { name, exact: true }) });
      await card.scrollIntoViewIfNeeded();
      await expect(card.getByRole("link", { name: /Ver online/ })).toHaveAttribute("href", `https://carlosmafraa.github.io/${slug}/`);
      await expect(card.getByRole("link", { name: /Código/ })).toHaveAttribute("href", `https://github.com/CarlosMafraa/${slug}`);
      const img = card.locator("img");
      await expect(img).toHaveAttribute("alt", /.+/);
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
    }
  });

  test("JuriFlow em construção, com print do login, link no ar e do código", async ({ page }) => {
    await page.goto("/");
    const card = page.locator(".pcard--wide");
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByRole("heading", { name: "JuriFlow" })).toBeVisible();
    await expect(card).toContainText("Em construção");
    await expect(card.getByRole("link", { name: /Ver online/ })).toHaveAttribute("href", "https://juriflow.mafrasolutions.workers.dev/login");
    await expect(card.getByRole("link", { name: /Código/ })).toHaveAttribute("href", "https://github.com/CarlosMafraa/juriflow");
    const img = card.locator("img");
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
    await expect(card.locator(".pipeline li")).toHaveCount(6);
  });

  test("projetos profissionais marcados como privados", async ({ page }) => {
    await page.goto("/");
    const pro = page.locator(".bento--projects .project");
    await expect(pro).toHaveCount(4);
    for (let i = 0; i < 4; i++) await expect(pro.nth(i).locator(".project__priv")).toContainText(/privado/i);
  });
});

test.describe("estilo nos dois temas", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`cards e código legíveis no tema ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");
      const look = await page.evaluate(() => {
        const bg = getComputedStyle(document.body).backgroundColor;
        const card = getComputedStyle(document.querySelector(".card")!);
        const kw = getComputedStyle(document.querySelector(".code .tk-k")!).color;
        const plain = getComputedStyle(document.querySelector(".code")!).color;
        return { bg, cardBg: card.backgroundColor, radius: parseFloat(card.borderTopLeftRadius), kw, plain };
      });
      expect(look.radius).toBeGreaterThan(10);
      expect(look.cardBg).not.toBe(look.bg);
      expect(look.kw).not.toBe(look.plain); // syntax highlight ativo
    });
  }
});

test("rota inexistente mostra a página 404", async ({ page }) => {
  const res = await page.goto("/nao-existe");
  expect(res?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Essa rota não existe.");
  await page.getByRole("link", { name: /Voltar ao início/ }).click();
  await expect(page.locator("#hero-title")).toBeVisible();
});
