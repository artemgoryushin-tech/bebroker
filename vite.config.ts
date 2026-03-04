import { defineConfig } from "vite";
import browserslist from "browserslist";
import { browserslistToTargets } from "lightningcss";

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
	build: {
		cssMinify: "lightningcss",
	},
});
