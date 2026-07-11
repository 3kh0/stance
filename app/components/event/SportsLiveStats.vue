<script setup lang="ts">
const SPORTRADAR_WIDGET_KEY = "357f35d2f90c86f7c3cc9b4771937688";
const SPORTRADAR_WIDGET_BASE = `https://widgets.sir.sportradar.com/${SPORTRADAR_WIDGET_KEY}`;
const SPORTRADAR_WIDGET_LOADER = `${SPORTRADAR_WIDGET_BASE}/widgetloader`;
const SPORTRADAR_LICENSE_PROXY = "/api/sportradar/licensing";
const SPORTRADAR_FISHNET_PROXY = "/api/sportradar/fishnet";
const SPORTRADAR_SCRIPT_ID = "stance-sportradar-widgetloader";
const SPORTRADAR_WIDGET_TYPE = "match.lmtplus";

type LicenseProxySnapshot = {
  fetch?: typeof window.fetch;
  xhrOpen?: typeof XMLHttpRequest.prototype.open;
  xhrSend?: typeof XMLHttpRequest.prototype.send;
};

const licenseProxySnapshot: LicenseProxySnapshot = {};

type SportradarCommand = (command: string, ...args: unknown[]) => unknown;
type SportradarLicense = {
  valid?: boolean;
  emsg?: string;
};

const props = defineProps<{
  matchId: number;
}>();

const emit = defineEmits<{
  status: [value: "loading" | "ready" | "failed"];
}>();

const widgetEl = ref<HTMLElement | null>(null);
const loading = ref(true);
const failed = ref(false);

watch([loading, failed], ([isLoading, isFailed]) => emit("status", isFailed ? "failed" : isLoading ? "loading" : "ready"), { immediate: true });
const failureMessage = ref("The Sportradar widget did not load for this match.");
let renderId = 0;

const widgetProps = computed(() => ({ matchId: props.matchId, layout: "single", tabsPosition: "top" }));

function sir(): SportradarCommand | undefined {
  return (window as Window & { SIR?: SportradarCommand }).SIR;
}

function shouldProxyLicense() {
  return !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
}

function isSportradarLicenseUrl(url: string) {
  return url.includes("/licensing") && (url.includes("widgets.sir.sportradar.com") || url.includes(SPORTRADAR_WIDGET_KEY));
}

function isSportradarFishnetUrl(url: string) {
  return /https?:\/\/[^/]*\.fn\.sportradar\.com\//i.test(url);
}

function proxiedSportradarUrl(url: string) {
  if (isSportradarLicenseUrl(url)) return SPORTRADAR_LICENSE_PROXY;
  if (isSportradarFishnetUrl(url)) return `${SPORTRADAR_FISHNET_PROXY}?url=${encodeURIComponent(url)}`;
  return url;
}

function installLicenseProxy() {
  if (!shouldProxyLicense()) return;
  if (!licenseProxySnapshot.fetch) {
    licenseProxySnapshot.fetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      const resolved = proxiedSportradarUrl(url);
      if (resolved !== url) return licenseProxySnapshot.fetch!(resolved, init);
      return licenseProxySnapshot.fetch!(input, init);
    };
  }

  if (!licenseProxySnapshot.xhrOpen) {
    licenseProxySnapshot.xhrOpen = XMLHttpRequest.prototype.open;
    licenseProxySnapshot.xhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, async?: boolean, username?: string | null, password?: string | null) {
      const raw = typeof url === "string" ? url : url.toString();
      const resolved = proxiedSportradarUrl(raw);
      return licenseProxySnapshot.xhrOpen!.call(this, method, resolved, async ?? true, username, password);
    };
    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      return licenseProxySnapshot.xhrSend!.call(this, body as XMLHttpRequestBodyInit | null);
    };
  }
}

function restoreLicenseProxy() {
  if (licenseProxySnapshot.fetch) {
    window.fetch = licenseProxySnapshot.fetch;
    licenseProxySnapshot.fetch = undefined;
  }
  if (licenseProxySnapshot.xhrOpen) {
    XMLHttpRequest.prototype.open = licenseProxySnapshot.xhrOpen;
    XMLHttpRequest.prototype.send = licenseProxySnapshot.xhrSend!;
    licenseProxySnapshot.xhrOpen = undefined;
    licenseProxySnapshot.xhrSend = undefined;
  }
}

function waitForSir() {
  return new Promise<void>((resolve, reject) => {
    if (sir()) return resolve();
    const existing = document.getElementById(SPORTRADAR_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    const timeout = setTimeout(() => reject(new Error("Sportradar loader timed out")), 12_000);
    script.addEventListener(
      "load",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => {
        clearTimeout(timeout);
        reject(new Error("Sportradar loader failed"));
      },
      { once: true },
    );
    if (!existing) {
      script.id = SPORTRADAR_SCRIPT_ID;
      script.async = true;
      script.src = SPORTRADAR_WIDGET_LOADER;
      document.head.appendChild(script);
    }
  });
}

const widgetFailureMessage = (error: unknown) => (error instanceof Error && /licens/i.test(error.message) ? "Live stats are not available for this domain." : "The Sportradar widget did not load for this match.");

async function validateLicense() {
  if (!shouldProxyLicense()) return;
  const res = await fetch(SPORTRADAR_LICENSE_PROXY, { cache: "no-store" });
  if (!res.ok) throw new Error("Sportradar licensing check failed");
  const license = (await res.json()) as SportradarLicense;
  if (license.valid === false) throw new Error(license.emsg || "Sportradar widget is not licensed");
}

async function renderWidget() {
  const el = widgetEl.value;
  if (!el) return;
  const currentRender = ++renderId;
  loading.value = true;
  failed.value = false;
  failureMessage.value = "The Sportradar widget did not load for this match.";

  el.innerHTML = "";
  el.removeAttribute("data-sr-loaded");
  el.removeAttribute("data-sr-widget");
  el.removeAttribute("data-sr-input-props");
  await nextTick();

  try {
    installLicenseProxy();
    await validateLicense();
    await waitForSir();
    if (currentRender !== renderId || !widgetEl.value) return;
    sir()?.("addWidget", el, SPORTRADAR_WIDGET_TYPE, widgetProps.value);
  } catch (error) {
    loading.value = false;
    failed.value = true;
    failureMessage.value = widgetFailureMessage(error);
    return;
  }

  const deadline = Date.now() + 12_000;
  while (currentRender === renderId && Date.now() < deadline) {
    if (el.hasAttribute("data-sr-loaded") || el.innerHTML.length > 500) {
      loading.value = false;
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (currentRender === renderId) {
    loading.value = false;
    failed.value = true;
  }
}

onMounted(async () => {
  await nextTick();
  await renderWidget();
});

watch(() => props.matchId, renderWidget);

onUnmounted(() => {
  renderId++;
  const el = widgetEl.value;
  if (el) sir()?.("removeWidget", el);
  el?.replaceChildren();
  restoreLicenseProxy();
});
</script>

<template>
  <section class="overflow-hidden rounded-xl border border-border">
    <div class="relative min-h-72 bg-bg">
      <div ref="widgetEl" class="min-h-72 w-full transition-opacity duration-500" :class="loading ? 'opacity-0' : 'opacity-100'" />

      <Transition name="pm-fade">
        <div v-if="loading" class="absolute inset-0 flex flex-col gap-4 bg-bg p-4">
          <div class="flex items-center justify-between gap-4 px-2 pt-2">
            <div class="flex flex-1 flex-col items-center gap-2">
              <div class="pm-skeleton h-11 w-11 rounded-full" />
              <div class="pm-skeleton h-3 w-16" />
            </div>
            <div class="flex flex-col items-center gap-2">
              <div class="pm-skeleton h-8 w-24" />
              <div class="pm-skeleton h-2.5 w-12" />
            </div>
            <div class="flex flex-1 flex-col items-center gap-2">
              <div class="pm-skeleton h-11 w-11 rounded-full" />
              <div class="pm-skeleton h-3 w-16" />
            </div>
          </div>
          <div class="pm-skeleton min-h-0 flex-1 rounded-lg" />
        </div>
      </Transition>

      <div v-if="failed" class="absolute inset-0 flex items-center justify-center bg-bg px-6 text-center">
        <div>
          <Icon name="lucide:bar-chart-3" class="mx-auto mb-2 h-5 w-5 text-text-3" />
          <p class="text-sm font-semibold text-white">Live stats unavailable</p>
          <p class="mt-1 text-xs text-text-2">{{ failureMessage }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
