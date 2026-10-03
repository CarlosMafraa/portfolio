// Servidor estático mínimo para os testes (sem dependências).
// Serve a raiz do repo e responde 404.html para rotas inexistentes, como o GitHub Pages.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = Number(process.env.PORT || 4173);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".jpg": "image/jpeg",
};

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
  if (path === "" || path.endsWith("/") || path.endsWith("\\")) path = join(path, "index.html");
  const file = join(ROOT, path);
  try {
    if (!file.startsWith(ROOT)) throw new Error("fora da raiz");
    if (!(await stat(file)).isFile()) throw new Error("não é arquivo");
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { "content-type": TYPES[".html"] });
    res.end(await readFile(join(ROOT, "404.html")));
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
