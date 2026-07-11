<script setup lang="ts">
const props = defineProps<{
  url?: string | null;
}>();

interface StreamSource {
  platform: "twitch" | "kick" | "youtube";
  kind: "channel" | "video";
  id: string;
  label: string;
  watchUrl: string;
  icon: string;
  color: string;
}

const stream = computed<StreamSource | null>(() => {
  const raw = props.url?.trim();
  let u: URL | null = null;
  try {
    if (raw) u = new URL(raw);
  } catch {}
  const segs = u?.pathname.split("/").filter(Boolean) ?? [];
  if (!u || !segs.length) return null;
  const host = u.hostname.toLowerCase();
  const tw = { icon: "simple-icons:twitch", color: "#9146FF" } as const;
  const yt = { icon: "simple-icons:youtube", color: "#FF0000" } as const;
  if (/(^|\.)twitch\.tv$/.test(host)) {
    if (segs[0]!.toLowerCase() === "videos" && segs[1]) return { platform: "twitch", kind: "video", id: segs[1], label: `VOD ${segs[1]}`, watchUrl: raw!, ...tw };
    return { platform: "twitch", kind: "channel", id: segs[0]!, label: segs[0]!, watchUrl: `https://www.twitch.tv/${segs[0]}`, ...tw };
  }
  if (/(^|\.)kick\.com$/.test(host)) return { platform: "kick", kind: "channel", id: segs[0]!, label: segs[0]!, watchUrl: `https://kick.com/${segs[0]}`, icon: "simple-icons:kick", color: "#53FC18" };
  if (/(^|\.)youtube\.com$/.test(host)) {
    if (segs[0] === "watch" && u.searchParams.get("v")) return { platform: "youtube", kind: "video", id: u.searchParams.get("v")!, label: "", watchUrl: raw!, ...yt };
    if (segs[0] === "channel" && segs[1]) return { platform: "youtube", kind: "channel", id: segs[1], label: "", watchUrl: raw!, ...yt };
  }
  return null;
});

const open = ref(false);
const loaded = ref(false);
watch(open, (v) => v && (loaded.value = true));

const host = ref("");
onMounted(() => (host.value = window.location.hostname));

const embedUrl = computed(() => {
  const s = stream.value;
  if (!s || !loaded.value) return "";
  if (s.platform === "kick") return `https://player.kick.com/${encodeURIComponent(s.id)}?autoplay=true&muted=true`;
  if (s.platform === "youtube") return `https://www.youtube.com/embed/${encodeURIComponent(s.id)}?autoplay=true&muted=true`;
  if (!host.value) return "";
  const base = `https://player.twitch.tv/?parent=${encodeURIComponent(host.value)}&autoplay=true&muted=true`;
  return s.kind === "video" ? `${base}&video=${encodeURIComponent(s.id)}` : `${base}&channel=${encodeURIComponent(s.id)}`;
});
</script>

<template>
  <div v-if="stream" class="pm-spring-in mb-6 overflow-hidden rounded-lg border border-border bg-surface" style="--pm-spring-delay: 60ms">
    <div class="flex cursor-pointer select-none items-center gap-2.5 px-4 py-2.5 transition-colors duration-150 hover:bg-surface-2" role="button" tabindex="0" @click="open = !open" @keydown.enter.prevent="open = !open" @keydown.space.prevent="open = !open">
      <Icon :name="stream.icon" class="h-4 w-4 shrink-0" :style="{ color: stream.color }" />
      <span class="shrink-0 text-[10px] font-bold uppercase tracking-widest text-text-3">Live Stream</span>
      <span class="truncate text-[12px] font-semibold text-white">{{ stream.label }}</span>
      <div class="ml-auto flex shrink-0 items-center gap-1.5">
        <span class="flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition-colors duration-150" :class="open ? 'border-border text-text-2' : 'border-white text-white'">
          <Icon :name="open ? 'lucide:chevron-up' : 'lucide:play'" class="h-3 w-3" :class="open ? '' : 'fill-current'" />
          {{ open ? "Hide" : "Watch" }}
        </span>
        <a :href="stream.watchUrl" target="_blank" rel="noopener noreferrer" class="pm-focus grid h-7 w-7 place-items-center rounded-md border border-border text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white" title="Open stream in new tab" @click.stop>
          <Icon name="lucide:external-link" class="h-3.5 w-3.5" />
        </a>
      </div>
    </div>

    <div class="grid transition-[grid-template-rows] duration-300 ease-out" :class="open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'">
      <div class="overflow-hidden">
        <div class="border-t border-border">
          <div class="relative w-full bg-black" style="aspect-ratio: 16 / 9">
            <iframe v-if="embedUrl" :src="embedUrl" class="absolute inset-0 h-full w-full" allowfullscreen frameborder="0" scrolling="no" title="Live stream" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
