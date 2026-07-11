<script setup lang="ts">
import type { SearchEventResult, SearchProfileResult } from "~/composables/useMarketSearch";
import { describeSearchEvent } from "~/composables/useMarketSearch";
import { ALL_PAGES } from "~/utils/navigation";

const router = useRouter();
const { isOpen, close } = useCommandPalette();
const { query, pending, results, error } = useMarketSearch();
const watchlist = useWatchlist();
const { openSignin } = useSigninModal();
const { hasAccount } = useAccount();

const inputRef = ref<HTMLInputElement | null>(null);
const listRef = ref<HTMLDivElement | null>(null);
const activeIndex = ref(0);
const prevFocus = ref<HTMLElement | null>(null);
let prevOverflow = "";

const accountActions = computed(() =>
  hasAccount()
    ? [
        { kind: "action" as const, label: "Add paper account", icon: "lucide:plus", run: () => openSignin("paper") },
        { kind: "action" as const, label: "Link wallet", icon: "lucide:wallet", run: () => openSignin("wallet") },
      ]
    : [
        { kind: "action" as const, label: "Log in", icon: "lucide:log-in", run: () => openSignin("choose") },
        { kind: "action" as const, label: "Sign up", icon: "lucide:user-plus", run: () => openSignin("choose") },
      ],
);

type Row = {
  gi: number;
  kind: string;
  label: string;
  icon?: string;
  to?: string;
  entry?: { id: string; slug?: string };
  ev?: SearchEventResult;
  profile?: SearchProfileResult;
  run?: () => void;
  meta?: ReturnType<typeof describeSearchEvent>;
};

const view = computed(() => {
  const q = query.value.trim().toLowerCase();
  const groups: { key: string; label: string; items: Row[] }[] = [];
  const match = (s: string) => !q || s.toLowerCase().includes(q);

  const pages = ALL_PAGES.filter((p) => match(p.label)).map((p) => ({ gi: 0, kind: "page", label: p.label, icon: p.icon, to: p.to }) as Row);
  if (pages.length) groups.push({ key: "pages", label: "Pages", items: pages });

  const actions = accountActions.value.filter((a) => match(a.label)).map((a) => ({ gi: 0, kind: a.kind, label: a.label, icon: a.icon, run: a.run }) as Row);
  if (actions.length) groups.push({ key: "actions", label: "Actions", items: actions });

  const watched = watchlist.items.value.filter((w) => match(w.title)).map((w) => ({ gi: 0, kind: "watchlist", label: w.title, icon: "lucide:star", entry: { id: w.id, slug: w.slug } }) as Row);
  if (watched.length) groups.push({ key: "watchlist", label: "Watchlist", items: watched });

  if (q && results.value?.events?.length) groups.push({ key: "markets", label: "Markets", items: results.value.events.map((ev) => ({ gi: 0, kind: "market", label: ev.title ?? "", ev, meta: describeSearchEvent(ev) }) as Row) });
  if (q && results.value?.profiles?.length) groups.push({ key: "profiles", label: "Profiles", items: results.value.profiles.filter((p) => p.name || p.pseudonym).map((p) => ({ gi: 0, kind: "profile", label: p.name || p.pseudonym || "", profile: p }) as Row) });

  let i = 0;
  for (const g of groups) for (const it of g.items) it.gi = i++;
  return { groups, flat: groups.flatMap((g) => g.items) };
});

const isSearching = computed(() => !!query.value.trim() && pending.value && !results.value);
const isEmpty = computed(() => view.value.flat.length === 0);

watch(
  () => view.value.flat.length,
  () => (activeIndex.value = 0),
);
function runRow(row: Row) {
  if (row.kind === "page" && row.to) router.push(row.to);
  else if (row.kind === "action") row.run?.();
  else if (row.kind === "watchlist" && row.entry) router.push(`/event/${row.entry.slug ?? row.entry.id}?x=${row.entry.id}`);
  else if (row.kind === "market" && row.ev) router.push(`/event/${row.ev.slug ?? row.ev.id}?x=${row.ev.id}`);
  else if (row.kind === "profile" && row.profile) router.push(`/@${encodeURIComponent(row.profile.name || row.profile.pseudonym || "")}`);
  close();
}

function onKeydown(e: KeyboardEvent) {
  const f = view.value.flat;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (f.length) activeIndex.value = (activeIndex.value + 1) % f.length;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (f.length) activeIndex.value = (activeIndex.value - 1 + f.length) % f.length;
  } else if (e.key === "Enter") {
    e.preventDefault();
    const row = f[activeIndex.value];
    if (row) runRow(row);
  } else if (e.key === "Escape") {
    e.preventDefault();
    close();
  }
}

watch(activeIndex, async () => {
  await nextTick();
  listRef.value?.querySelector<HTMLElement>(`[data-gi="${activeIndex.value}"]`)?.scrollIntoView({ block: "nearest" });
});

watch(isOpen, async (open) => {
  if (typeof document === "undefined") return;
  if (open) {
    prevFocus.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    activeIndex.value = 0;
    await nextTick();
    inputRef.value?.focus();
  } else {
    document.body.style.overflow = prevOverflow;
    prevOverflow = "";
    query.value = "";
    prevFocus.value?.focus();
    prevFocus.value = null;
  }
});

onMounted(() => watchlist.load());

onBeforeUnmount(() => {
  if (isOpen.value && typeof document !== "undefined") document.body.style.overflow = prevOverflow;
});

function onBackdrop(e: MouseEvent) {
  if (e.target === e.currentTarget) close();
}
</script>

<template>
  <Teleport to="body">
    <Transition name="cmdk">
      <div v-if="isOpen" class="fixed inset-0 z-50 flex items-start justify-center bg-black/75 px-4 pt-[12vh] backdrop-blur-sm max-sm:items-stretch max-sm:p-0 max-sm:pt-[env(safe-area-inset-top)]" @click="onBackdrop">
        <div class="cmdk__panel flex max-h-[70vh] w-full max-w-160 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl max-sm:max-h-none max-sm:max-w-none max-sm:rounded-none max-sm:border-0" role="dialog" aria-modal="true" aria-label="Command palette">
          <div class="flex shrink-0 items-center gap-2.5 border-b border-border px-4">
            <Icon name="lucide:search" class="pointer-events-none h-4 w-4 shrink-0 text-text-3" />
            <input ref="inputRef" v-model="query" type="text" placeholder="Search markets or jump to a page…" autocomplete="off" spellcheck="false" class="h-12 min-w-0 flex-1 bg-transparent text-[15px] leading-5 text-text outline-none placeholder:text-text-3 max-sm:text-base" @keydown="onKeydown" />
            <button v-if="query" type="button" class="pm-focus grid h-6 w-6 shrink-0 place-items-center rounded-full text-text-3 hover:text-white" aria-label="Clear" @click="query = ''">
              <Icon name="lucide:x" class="h-4 w-4" />
            </button>
            <button type="button" class="pm-focus shrink-0 rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-medium text-text-3 sm:hidden" @click="close">Esc</button>
          </div>

          <div ref="listRef" class="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2 pb-[env(safe-area-inset-bottom)]">
            <div v-if="isSearching" class="px-4 py-10 text-center text-sm text-text-3">Searching…</div>
            <div v-else-if="error" class="px-4 py-10 text-center text-sm text-no">{{ error }}</div>
            <div v-else-if="isEmpty" class="px-4 py-10 text-center text-sm text-text-3">No results</div>

            <template v-else>
              <div v-for="group in view.groups" :key="group.key" class="pb-1.5">
                <div class="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-text-3">{{ group.label }}</div>
                <button
                  v-for="row in group.items"
                  :key="row.gi"
                  type="button"
                  :data-gi="row.gi"
                  class="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors"
                  :class="[row.gi === activeIndex ? 'bg-white/10 shadow-[inset_2px_0_0_var(--color-white)]' : 'hover:bg-surface-2', row.kind === 'market' && row.meta?.resolved ? 'opacity-50' : '']"
                  @click="runRow(row)"
                  @mousemove="activeIndex = row.gi"
                >
                  <template v-if="row.kind === 'market' && row.ev && row.meta">
                    <MarketIcon v-if="row.ev.image || row.ev.icon" :src="row.ev.image || row.ev.icon" alt="" class="h-9 w-9 shrink-0 rounded-[7px] object-cover" />
                    <div v-else class="h-9 w-9 shrink-0 rounded-[7px] bg-surface-2" />
                    <div class="min-w-0 flex-1">
                      <div class="truncate text-sm leading-5 text-white">{{ row.ev.title }}</div>
                    </div>
                    <div class="shrink-0 text-right">
                      <template v-if="row.meta.resolved">
                        <div class="flex items-center justify-end gap-1.5 text-sm text-text-2">
                          <span class="max-w-30 truncate">{{ row.meta.resolvedLabel || "Resolved" }}</span>
                          <Icon name="lucide:circle-check" class="h-4 w-4 shrink-0 text-yes" />
                        </div>
                        <div v-if="row.meta.extraCount > 0" class="text-xs text-text-3">+ {{ row.meta.extraCount }} more</div>
                      </template>
                      <template v-else>
                        <div class="font-mono text-base font-semibold leading-5 text-white">{{ row.meta.percent }}%</div>
                        <div v-if="row.meta.endDate" class="text-xs text-text-3">{{ row.meta.endDate }}</div>
                      </template>
                    </div>
                  </template>
                  <template v-else-if="row.kind === 'profile' && row.profile">
                    <img :src="row.profile.profileImage || `/api/pfp?${encodeURIComponent(row.profile.name ?? row.profile.pseudonym ?? row.profile.proxyWallet ?? '')}`" alt="" class="h-9 w-9 shrink-0 rounded-full border border-border object-cover" />
                    <div class="min-w-0 flex-1">
                      <div class="truncate text-sm text-white">@{{ row.profile.name || row.profile.pseudonym }}</div>
                      <div v-if="row.profile.bio || (row.profile.name && row.profile.pseudonym)" class="truncate text-xs text-text-3">{{ row.profile.bio || row.profile.pseudonym }}</div>
                    </div>
                    <Icon name="lucide:corner-down-left" class="h-3.5 w-3.5 shrink-0 text-white" :class="row.gi === activeIndex ? '' : 'opacity-0'" />
                  </template>
                  <template v-else>
                    <div class="grid h-9 w-9 shrink-0 place-items-center rounded-[7px] transition-colors" :class="row.gi === activeIndex ? 'bg-white/15 text-white' : 'bg-surface-2 text-text-2'">
                      <Icon :name="row.icon || 'lucide:circle'" class="h-4 w-4" />
                    </div>
                    <div class="min-w-0 flex-1 truncate text-sm text-white">{{ row.label }}</div>
                    <Icon name="lucide:corner-down-left" class="h-3.5 w-3.5 shrink-0 text-white" :class="row.gi === activeIndex ? '' : 'opacity-0'" />
                  </template>
                </button>
              </div>
            </template>
          </div>

          <div class="flex shrink-0 items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-text-3 max-sm:hidden">
            <span class="flex items-center gap-1.5"><kbd class="rounded border border-border bg-surface-2 px-1 py-0.5 font-mono">↑↓</kbd> navigate</span>
            <span class="flex items-center gap-1.5"><kbd class="rounded border border-border bg-surface-2 px-1 py-0.5 font-mono">↵</kbd> open</span>
            <span class="flex items-center gap-1.5"><kbd class="rounded border border-border bg-surface-2 px-1 py-0.5 font-mono">esc</kbd> close</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cmdk__panel {
  animation: cmdk-in 220ms cubic-bezier(0.22, 1, 0.36, 1);
}
.cmdk-leave-active .cmdk__panel {
  animation: cmdk-out 160ms ease-in;
}
.cmdk-enter-active,
.cmdk-leave-active {
  transition: opacity 200ms ease;
}
.cmdk-enter-from,
.cmdk-leave-to {
  opacity: 0;
}

@keyframes cmdk-in {
  from {
    transform: translateY(-8px) scale(0.99);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}
@keyframes cmdk-out {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(-8px);
    opacity: 0;
  }
}

@media (max-width: 639px) {
  .cmdk__panel {
    animation: cmdk-in-sheet 240ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  @keyframes cmdk-in-sheet {
    from {
      transform: translateY(12px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .cmdk__panel,
  .cmdk-leave-active .cmdk__panel,
  .cmdk-enter-active,
  .cmdk-leave-active {
    animation: none;
    transition: none;
  }
}
</style>
