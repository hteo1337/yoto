import type {Config} from "@react-router/dev/config"

export default {
    ssr: true,
    buildDirectory:
        process.env.YOTO_SELFHOST === "1" ? "build-selfhost" : "build",
    future: {
        v8_middleware: true,
        v8_viteEnvironmentApi: true,
    },
} satisfies Config
