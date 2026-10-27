import tsconfigPaths from "vite-tsconfig-paths"
import {defineConfig} from "vitest/config"

const config = defineConfig({
    resolve: {
        alias: {
            "cloudflare:workers": new URL(
                "./selfhost/shims/workers.ts",
                import.meta.url,
            ).pathname,
        },
    },
    plugins: [tsconfigPaths()],
    test: {
        globals: true,
    },
})

export default config
