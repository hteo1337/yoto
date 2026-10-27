import {reactRouter} from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import {defineConfig} from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
    plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
    resolve: {
        alias: {
            "cloudflare:workers": new URL(
                "./selfhost/shims/workers.ts",
                import.meta.url,
            ).pathname,
            "@cloudflare/sandbox": new URL(
                "./selfhost/shims/sandbox.ts",
                import.meta.url,
            ).pathname,
        },
    },
    ssr: {noExternal: ["@cloudflare/sandbox"]},
    environments: {
        ssr: {
            build: {rollupOptions: {input: "./selfhost/server.ts"}},
        },
    },
})
