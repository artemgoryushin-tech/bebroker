import { defineConfig, type Plugin } from "vite";
import browserslist from "browserslist";
import fs from "fs";
import path from "path";
import { browserslistToTargets } from "lightningcss";

function copyStaticLandingPages(staticDirs: string[]): Plugin {
  let rootDir = process.cwd();
  let outDir = path.resolve(rootDir, "dist");

  return {
    name: "copy-static-landing-pages",

    configResolved(config) {
      rootDir = config.root;
      outDir = path.resolve(config.root, config.build.outDir || "dist");
    },

    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const rawUrl = req.url || "/";
        const [pathname, search = ""] = rawUrl.split("?");

        if (!pathname || path.extname(pathname)) {
          next();
          return;
        }

        for (const dir of staticDirs) {
          if (pathname !== `/${dir}` && !pathname.startsWith(`/${dir}/`)) {
            continue;
          }

          const normalizedPath = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
          const candidate = path.resolve(rootDir, normalizedPath.slice(1), "index.html");

          if (fs.existsSync(candidate)) {
            req.url = `${normalizedPath}/index.html${search ? `?${search}` : ""}`;
          }

          break;
        }

        next();
      });
    },

    closeBundle() {
      for (const dir of staticDirs) {
        const sourceDir = path.resolve(rootDir, dir);
        const targetDir = path.resolve(outDir, dir);

        if (!fs.existsSync(sourceDir)) {
          continue;
        }

        fs.cpSync(sourceDir, targetDir, {
          recursive: true,
          force: true,
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
    fallbackLang: string,
  ) => {
    if (!translations) return html.replaceAll("{{lang}}", fallbackLang);
    let result = html;
    const mergedTranslations = { lang: fallbackLang, ...translations };
    for (const key in mergedTranslations) {
      if (Object.prototype.hasOwnProperty.call(mergedTranslations, key)) {
        result = result.replaceAll(`{{${key}}}`, String(mergedTranslations[key]));
      }
    }
    return result;
  };

  const rewriteLocalizedAssetPaths = (html: string) =>
    html
      .replaceAll('href="./assets/', 'href="../assets/')
      .replaceAll('src="./assets/', 'src="../assets/');

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
        const match = url.match(/^\/([a-z]{2})(\/|$)/i);

        if (match) {
          const lang = match[1].toLowerCase();
          req.url = `/index.html?__lang=${lang}`;
        }

        next();
      });
    },

    transformIndexHtml(html, ctx) {
      // Only translate on the dev server.
      // During build we keep placeholders and render each locale in closeBundle().
      if (!(ctx as { server?: unknown }).server) {
        return html;
      }

      const url = (ctx as any).originalUrl || (ctx as any).path || "/";
      const lang = resolveLangFromUrl(url);
      const locales = loadLocales();
      const translations = locales[lang] || locales[defaultLang];
      return applyTranslations(html, translations, lang);
    },

    closeBundle() {
      const indexPath = path.join(outDir, "index.html");

      if (!fs.existsSync(indexPath) || !fs.existsSync(localesDir)) {
        return;
      }

      const baseHtml = fs.readFileSync(indexPath, "utf-8");
      const locales = loadLocales();

      for (const [lang, translations] of Object.entries(locales)) {
        const translatedHtml = applyTranslations(baseHtml, translations, lang);
        const isDefaultLang = lang === defaultLang;
        const targets = isDefaultLang
          ? [path.join(outDir, "index.html"), path.join(outDir, lang, "index.html")]
          : [path.join(outDir, lang, "index.html")];

        for (const target of targets) {
          const dir = path.dirname(target);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          const html = target === path.join(outDir, "index.html")
            ? translatedHtml
            : rewriteLocalizedAssetPaths(translatedHtml);

          fs.writeFileSync(target, html, "utf-8");
        }
      }
    },
  };
}

export default defineConfig({
	base: "",
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
		cssMinify: "lightningcss",
	},
});
