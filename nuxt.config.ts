// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";
export default defineNuxtConfig({
  compatibilityDate: "2026-05-18",
  devtools: {
    enabled: true,
    timeline: {
      enabled: true,
    },
  },
  runtimeConfig: {
    public: {
      siteUrl: "",
    },
  },
  nitro: {
    serverAssets: [{ baseName: "fonts", dir: "./server/assets/fonts" }],
  },
  css: ["~/assets/css/main.css"],
  modules: ["@nuxt/icon", "@nuxt/image", "@nuxt/hints", "@vercel/speed-insights", "@vite-pwa/nuxt"],
  pwa: {
    registerType: "autoUpdate",
    manifest: {
      name: "Stance",
      short_name: "Stance",
      description: "Trade on Polymarket with an elegant and powerful terminal built by traders, for traders.",
      start_url: "/",
      display: "standalone",
      background_color: "#0a0a0a",
      theme_color: "#0a0a0a",
      icons: [
        { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/pwa-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    workbox: {
      globPatterns: ["**/*.{js,css,svg,png,ico,woff,woff2}"],
      navigateFallback: undefined,
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      skipWaiting: true,
      runtimeCaching: [
        {
          urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
          handler: "NetworkOnly",
        },
        {
          urlPattern: ({ request }) => request.destination === "image",
          handler: "StaleWhileRevalidate",
          options: {
            cacheName: "stance-images",
            expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
    devOptions: {
      enabled: false,
    },
  },
  icon: {
    mode: "svg",
  },
  image: {
    provider: "vercel",
    domains: ["polymarket-upload.s3.us-east-2.amazonaws.com"],
    screens: { icon: 128, icon2x: 256 },
  },
  vite: {
    optimizeDeps: {
      include: [
        "nprogress", // CJS
        "d3-geo", // lazy-imported by the elections globe
        "topojson-client",
      ],
    },
    plugins: [tailwindcss()],
  },
  app: {
    head: {
      charset: "utf-8",
      viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
      title: "Stance - Elegant Polymarket Trading Terminal",
      htmlAttrs: {
        lang: "en",
      },
      script: [
        {
          innerHTML: `(function(){try{var t=localStorage.getItem("stance_theme");if(t&&["dark","light","catppuccin-mocha","nord","tokyo-night","dracula","gruvbox","rose-pine"].indexOf(t)>-1)document.documentElement.dataset.theme=t;}catch(e){}})();`,
          tagPosition: "head",
        },
      ],
      meta: [
        {
          name: "description",
          content: "Trade on Polymarket with an elegant and powerful terminal built by traders, for traders.",
        },
        { name: "theme-color", content: "#0a0a0a" },
      ],
      link: [
        {
          rel: "icon",
          type: "image/svg+xml",
          href: "/favicon.svg",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "32x32",
          href: "/favicon.png",
        },
        { rel: "apple-touch-icon", sizes: "180x180", href: "/icon.png" },
        { rel: "mask-icon", href: "/mask-icon.svg", color: "#0a0a0a" },
      ],
    },
  },
  hooks: {
    "vite:extendConfig"(config) {
      const build = ((config as { build?: Record<string, unknown> }).build ??= {});
      const rollupOptions = (build.rollupOptions ??= {}) as {
        onwarn?: (warning: unknown, warn: (w: unknown) => void) => void;
      };
      const prev = rollupOptions.onwarn;
      rollupOptions.onwarn = (warning, warn) => {
        const w = warning as { plugin?: string };
        if (w.plugin === "@tailwindcss/vite:generate:build") return;
        if (w.plugin === "nuxt:module-preload-polyfill") return;
        if (prev) prev(warning, warn);
        else warn(warning);
      };
    },
  },
});
