// Shared helper: serve the built Explorer (packages/explorer/dist) over HTTP
// for release-gate browser automation. The Vite build uses a relative base,
// so it can be mounted at any path; gates mount it at /explorer/ to mirror
// the production deployment.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

/**
 * Serve a static directory at a base path on 127.0.0.1.
 * @param {string} distDir absolute path to the directory to serve
 * @param {{ basePath?: string }} [options] basePath defaults to "/explorer/"
 * @returns {Promise<{ origin: string, baseUrl: string, close: () => Promise<void> }>}
 */
export async function serveStaticDir(distDir, options = {}) {
  const basePath = options.basePath ?? "/explorer/";
  if (!existsSync(join(distDir, "index.html"))) {
    throw new Error(`serveStaticDir: ${distDir} has no index.html; build the Explorer first`);
  }

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      let pathname = decodeURIComponent(url.pathname);
      if (!pathname.startsWith(basePath)) {
        if (pathname === basePath.replace(/\/$/, "")) {
          response.writeHead(302, { location: basePath });
          response.end();
          return;
        }
        response.writeHead(404);
        response.end("not found");
        return;
      }
      let relativePath = pathname.slice(basePath.length);
      if (relativePath === "" || relativePath.endsWith("/")) {
        relativePath += "index.html";
      }
      const filePath = normalize(join(distDir, relativePath));
      if (!filePath.startsWith(normalize(distDir))) {
        response.writeHead(403);
        response.end("forbidden");
        return;
      }
      if (!existsSync(filePath)) {
        response.writeHead(404);
        response.end("not found");
        return;
      }
      const body = await readFile(filePath);
      response.writeHead(200, {
        "content-type": MIME_TYPES[extname(filePath)] ?? "application/octet-stream"
      });
      response.end(body);
    } catch (error) {
      response.writeHead(500);
      response.end(String(error));
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  return {
    origin,
    baseUrl: `${origin}${basePath}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}
