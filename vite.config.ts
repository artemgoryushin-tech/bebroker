import { defineConfig, type Plugin } from "vite";
import browserslist from "browserslist";
import fs from "fs";
import path from "path";
import { browserslistToTargets } from "lightningcss";

function copyStaticLandingPages(staticDirs: string[]): Plugin {
  const workspaceRoot = process.cwd();
  let outDir = path.resolve(workspaceRoot, "dist");

  const resolveStaticFile = (pathname: string) => {
    for (const dir of staticDirs) {
      if (pathname !== `/${dir}` && !pathname.startsWith(`/${dir}/`)) {
        continue;
      }

      const normalizedPath = pathname.endsWith("/") && pathname.length > 1
        ? pathname.slice(0, -1)
        : pathname;
      const relativePath = normalizedPath.slice(1);
      const candidate = path.extname(normalizedPath)
        ? path.resolve(workspaceRoot, relativePath)
        : path.resolve(workspaceRoot, relativePath, "index.html");

      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  };

  return {
    name: "copy-static-landing-pages",

    configResolved(config) {
      outDir = path.resolve(workspaceRoot, config.build.outDir || "dist");
    },

    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const rawUrl = req.url || "/";
        const [pathname, search = ""] = rawUrl.split("?");
        const candidate = resolveStaticFile(pathname);

        if (candidate) {
          req.url = `/@fs${candidate}${search ? `?${search}` : ""}`;
        }

        next();
      });
    },

    closeBundle() {
      for (const dir of staticDirs) {
        const sourceDir = path.resolve(workspaceRoot, dir);
        const targetDir = path.resolve(outDir, dir);

        if (!fs.existsSync(sourceDir)) {
          continue;
        }

        fs.cpSync(sourceDir, targetDir, {
          recursive: true,
          force: true,
          filter: (source) => {
            const relativePath = path.relative(sourceDir, source);
            return relativePath !== "index.html";
          },
        });
      }
    },
  };
}

function i18nPages(): Plugin {
  const defaultLang = "en";
  let rootDir = process.cwd();
  let outDir = path.resolve(rootDir, "dist");
  let localesDir = path.resolve(rootDir, "locales");

  const loadLocales = () => {
    if (!fs.existsSync(localesDir)) return {};
    const files = fs
      .readdirSync(localesDir)
      .filter((file) => file.endsWith(".json"));

    const map: Record<string, Record<string, string>> = {};

    for (const file of files) {
      const lang = file.replace(".json", "");
      const translations = JSON.parse(
        fs.readFileSync(path.join(localesDir, file), "utf-8"),
      );
      map[lang] = translations;
    }

    return map;
  };

  const applyTranslations = (
    html: string,
    translations: Record<string, string> | undefined,
    fallbackTranslations: Record<string, string> | undefined,
    fallbackLang: string,
  ) => {
    if (!translations && !fallbackTranslations) return html.replaceAll("{{lang}}", fallbackLang);
    let result = html;
    const mergedTranslations = { lang: fallbackLang, ...fallbackTranslations, ...translations };
    for (const key in mergedTranslations) {
      if (Object.prototype.hasOwnProperty.call(mergedTranslations, key)) {
        result = result.replaceAll(`{{${key}}}`, String(mergedTranslations[key]));
      }
    }
    return result;
  };

  const resolveLangFromUrl = (url: string | undefined): string => {
    if (!url) return defaultLang;

    const pathMatch = url.match(/^\/([a-z]{2})(\/|$)/i);
    if (pathMatch) {
      return pathMatch[1].toLowerCase();
    }

    const queryMatch = url.match(/[?&]__lang=([a-z]{2})/i);
    if (queryMatch) {
      return queryMatch[1].toLowerCase();
    }

    return defaultLang;
  };

  return {
    name: "i18n-pages",

    configResolved(config) {
      rootDir = config.root;
      outDir = path.resolve(config.root, config.build.outDir || "dist");
      localesDir = path.resolve(config.root, "locales");
    },

    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url || "/";
        const [requestPathname] = url.split("?");
        const localizedResellMatch = requestPathname.match(/^\/([a-z]{2})\/resell(?:\/index\.html|\/)?$/i);
        const isDefaultResellRoute = /^\/resell(?:\/index\.html|\/)?$/i.test(requestPathname);

        if (localizedResellMatch || isDefaultResellRoute) {
          const lang = localizedResellMatch ? localizedResellMatch[1].toLowerCase() : defaultLang;
          const locales = loadLocales();
          const translations = locales[lang] || locales[defaultLang];
          const sourcePath = path.resolve(rootDir, "..", "resell", "index.html");

          if (fs.existsSync(sourcePath)) {
            let result = applyTranslations(
              fs.readFileSync(sourcePath, "utf-8"),
              translations,
              locales[defaultLang],
              lang,
            );

            _res.statusCode = 200;
            _res.setHeader("Content-Type", "text/html; charset=utf-8");
            _res.end(result);
            return;
          }
        }

        const match = url.match(/^\/([a-z]{2})(\/|$)/i);

        if (match) {
          const lang = match[1].toLowerCase();

          const [pathname, search = ""] = url.split("?");
          const rest = pathname.slice(match[0].length).replace(/^\/+/, "");

          let htmlPath: string | null = null;
          if (!rest || rest === "index.html") {
            htmlPath = "/index.html";
          } else if (rest.startsWith("giveaway")) {
            htmlPath = "/giveaway/index.html";
          } else if (rest.startsWith("resell")) {
            htmlPath = "/resell/index.html";
          } else if (rest.startsWith("privacy-policy")) {
            htmlPath = "/privacy-policy/index.html";
          } else if (rest.startsWith("terms-and-conditions")) {
            htmlPath = "/terms-and-conditions/index.html";
          }

          if (htmlPath) {
            req.url = `${htmlPath}?__lang=${lang}${search ? `&${search}` : ""}`;
          }
        }

        next();
      });
    },

    transformIndexHtml(html, ctx) {
      if (!(ctx as { server?: unknown }).server) {
        return html;
      }

      const url = (ctx as any).originalUrl || (ctx as any).path || "/";
      const lang = resolveLangFromUrl(url);
      const locales = loadLocales();
      const translations = locales[lang] || locales[defaultLang];
      let result = applyTranslations(html, translations, locales[defaultLang], lang);

      const pathname = String(url).split("?")[0];
      const isGiveawayRoute =
        /^\/[a-z]{2}\/giveaway(?:\/|$)/i.test(pathname) ||
        /^\/giveaway(?:\/|$)/i.test(pathname);

      if (isGiveawayRoute) {
        result = result
          .replace(/(?:\.\.\/)+assets\//g, "/assets/")
          .replace(/\.\/assets\//g, "/assets/");
      }

      return result;
    },

    closeBundle() {
      if (!fs.existsSync(localesDir)) return;

      const translatablePages = [
        "index.html",
        path.join("giveaway", "index.html"),
        path.join("resell", "index.html"),
      ];
      const locales = loadLocales();

      for (const pageRelPath of translatablePages) {
        const distBasePath = path.join(outDir, pageRelPath);
        const sourceBasePath = path.resolve(rootDir, "..", pageRelPath);
        const basePath = fs.existsSync(distBasePath) ? distBasePath : sourceBasePath;
        if (!fs.existsSync(basePath)) continue;

        const baseHtml = fs.readFileSync(basePath, "utf-8");
        const fallbackTranslations = locales[defaultLang];
        const baseDir = path.dirname(pageRelPath);
        const baseDirDepth = baseDir === "."
          ? 0
          : baseDir.split(path.sep).filter(Boolean).length;

        for (const [lang, translations] of Object.entries(locales)) {
          const result = applyTranslations(baseHtml, translations, fallbackTranslations, lang);
          const isDefaultLang = lang === defaultLang;

          const localeTargetPath = path.join(outDir, lang, pageRelPath);
          const targets = isDefaultLang
            ? [path.join(outDir, pageRelPath), localeTargetPath]
            : [localeTargetPath];

          for (const target of targets) {
            const targetRelPath = path.relative(outDir, target);
            const targetDir = path.dirname(targetRelPath);
            const targetDirDepth = targetDir === "."
              ? 0
              : targetDir.split(path.sep).filter(Boolean).length;
            const assetShift = targetDirDepth - baseDirDepth;

            let finalHtml = result;
            if (assetShift > 0) {
              const prefix = "../".repeat(assetShift);
              finalHtml = finalHtml.replace(
                /((?:\.\.\/)+assets\/)/g,
                prefix + "$1",
              );
            }

            const shouldRootAssetUrls = pageRelPath !== path.join("resell", "index.html");
            if (shouldRootAssetUrls) {
              finalHtml = finalHtml
                .replace(/(?:\.\.\/)+assets\//g, "/assets/")
                .replace(/\.\/assets\//g, "/assets/");
            }

            const dir = path.dirname(target);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(target, finalHtml, "utf-8");
          }
        }
      }
    },
  };
}

export default defineConfig({
  root: path.resolve(process.cwd(), "src"),
  base: "",
  publicDir: path.resolve(process.cwd(), "public"),
  server: {
    port: 3000,
    open: false,
  },
  css: {
    transformer: "lightningcss",
    lightningcss: {
      targets: browserslistToTargets(browserslist(">= 0.25%")),
    },
  },
  plugins: [i18nPages(), copyStaticLandingPages(["giveaway", "resell"])],
  build: {
    emptyOutDir: true,
    outDir: path.resolve(process.cwd(), "dist"),
    cssMinify: "lightningcss",
    rollupOptions: {
      input: {
        index: path.resolve(process.cwd(), "src/index.html"),
        giveaway: path.resolve(process.cwd(), "src/giveaway/index.html"),
        privacy: path.resolve(process.cwd(), "src/privacy-policy/index.html"),
        terms: path.resolve(process.cwd(), "src/terms-and-conditions/index.html"),
      },
    },
  },
});
