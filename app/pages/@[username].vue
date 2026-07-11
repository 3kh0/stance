<script setup lang="ts">
import { formatRelativeTime } from "~/utils/markets";

interface PublicProfile {
  name?: string;
  pseudonym?: string;
  displayUsernamePublic?: boolean;
  profileImage?: string;
  bio?: string;
  proxyWallet: string;
  createdAt?: string;
  xUsername?: string;
  verifiedBadge?: boolean;
  takerTierName?: string;
}

interface PublicPosition {
  asset?: string;
  conditionId?: string;
  size?: number;
  avgPrice?: number;
  initialValue?: number;
  currentValue?: number;
  cashPnl?: number;
  percentPnl?: number;
  curPrice?: number;
  title?: string;
  slug?: string;
  icon?: string;
  eventSlug?: string;
  outcome?: string;
  endDate?: string;
}

interface PublicActivity {
  timestamp?: number;
  type?: string;
  side?: string;
  size?: number;
  usdcSize?: number;
  price?: number;
  title?: string;
  slug?: string;
  icon?: string;
  eventSlug?: string;
  outcome?: string;
  transactionHash?: string;
}

interface ProfileResponse {
  profile: PublicProfile;
  stats: { positionsValue: number; openPnl: number; largestOpenWin: number; positions: number; activity: number };
  positions: PublicPosition[];
  activity: PublicActivity[];
}

const route = useRoute();
const router = useRouter();
const username = computed(() => String(route.params.username ?? "").replace(/^@+/, ""));
const activeTab = ref<"positions" | "activity">("positions");
const search = ref("");

const { data, pending, error, refresh } = await useFetch<ProfileResponse>(() => `/api/profile/${encodeURIComponent(username.value)}`, { watch: [username] });

const profile = computed(() => data.value?.profile);
const stats = computed(() => data.value?.stats);
const displayName = computed(() => profile.value?.name || profile.value?.pseudonym || username.value);
const avatarSrc = computed(() => profile.value?.profileImage || `/api/pfp?${encodeURIComponent(displayName.value)}`);
const query = computed(() => search.value.trim().toLowerCase());

const filteredPositions = computed(() => (data.value?.positions ?? []).filter((p) => !query.value || `${p.title ?? ""} ${p.outcome ?? ""}`.toLowerCase().includes(query.value)));

const filteredActivity = computed(() => (data.value?.activity ?? []).filter((a) => !query.value || `${activityTitle(a)} ${activitySubtitle(a)} ${activityLabel(a)} ${a.type ?? ""} ${a.side ?? ""} ${a.outcome ?? ""}`.toLowerCase().includes(query.value)));

const tabClass = (t: "positions" | "activity") => ["pm-focus text-[11px] font-bold uppercase tracking-widest transition-colors duration-150 motion-reduce:transition-none", activeTab.value === t ? "text-white" : "text-text-3 hover:text-text-2"];
const money = (v: number | undefined, d = 2) => (Number.isFinite(v) ? (v ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: d, maximumFractionDigits: d }) : "$0.00");
const signedMoney = (v: number | undefined) => `${(v ?? 0) >= 0 ? "+" : "-"}${money(Math.abs(v ?? 0))}`;
const number = (v: number | undefined, d = 1) => (Number.isFinite(v) ? (v ?? 0).toLocaleString("en-US", { maximumFractionDigits: d }) : "0");
const cents = (v: number | undefined) => `${number((v ?? 0) * 100, (v ?? 0) < 0.01 ? 2 : 1)}¢`;
const percent = (v: number | undefined) => `${(v ?? 0) >= 0 ? "+" : "-"}${number(Math.abs(v ?? 0), 2)}%`;
const shortWallet = (w: string | undefined) => (w ? `${w.slice(0, 6)}...${w.slice(-4)}` : "");
const profileHref = computed(() => `https://polymarket.com/@${encodeURIComponent(displayName.value)}`);
const twitterHref = computed(() => (profile.value?.xUsername ? `https://x.com/${profile.value.xUsername}` : ""));

function formatJoinDate(raw: string | undefined): string {
  if (!raw) return "Join date unavailable";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "Join date unavailable" : `Joined ${d.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
}

const eventHref = (r: { eventSlug?: string; slug?: string }) => {
  const s = r.eventSlug || r.slug;
  return s ? `/event/${s}` : undefined;
};

function activityLabel(a: PublicActivity): string {
  const t = (a.type || a.side || "Activity").toLowerCase();
  if (t === "yield") return "Yield";
  if (a.side) return a.side.toLowerCase() === "buy" ? "Buy" : a.side.toLowerCase() === "sell" ? "Sell" : a.side;
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const activityAmount = (a: PublicActivity) => Number(a.usdcSize) || (Number(a.size) || 0) * (Number(a.price) || 0);
const isYieldActivity = (a: PublicActivity) => a.type?.toLowerCase() === "yield";
const activityTitle = (a: PublicActivity) => (isYieldActivity(a) ? "Holdings yield (3.25% APR)" : a.title || activityLabel(a));
const activitySubtitle = (a: PublicActivity) => {
  if (isYieldActivity(a)) return `${money(activityAmount(a))} credited`;
  const n = Number(a.size) || 0;
  return n > 0 ? `${number(n, 2)} sh` : "";
};
const activityTypeClass = (a: PublicActivity) => {
  const l = activityLabel(a);
  return l === "Sell" || l === "Yield" ? "text-yes" : l === "Buy" ? "text-no" : "text-text-3";
};
const explorerHref = (a: PublicActivity) => {
  const h = a.transactionHash ?? "";
  return /^0x[a-fA-F0-9]{64}$/.test(h) ? `https://polygonscan.com/tx/${h}` : "";
};
const openActivity = (a: PublicActivity) => {
  const h = eventHref(a);
  if (h) router.push(h);
};

useSeoMeta({
  title: () => `@${displayName.value} on Stance`,
  description: () => (profile.value?.bio ? `${profile.value.bio}` : `Public Polymarket profile for @${displayName.value}.`),
});
</script>

<template>
  <div class="pm-page">
    <main class="pm-container py-5">
      <div v-if="pending" class="space-y-4">
        <section class="pm-panel p-4">
          <div class="flex items-center gap-4">
            <div class="pm-skeleton h-18 w-18 rounded-full" />
            <div class="min-w-0 flex-1">
              <div class="pm-skeleton mb-3 h-6 w-48 max-w-full" />
              <div class="pm-skeleton h-4 w-72 max-w-full" />
            </div>
          </div>
        </section>
        <section class="pm-panel p-4">
          <div class="grid gap-3 sm:grid-cols-4">
            <div v-for="i in 4" :key="i" class="pm-skeleton h-16 rounded-lg" />
          </div>
        </section>
      </div>

      <div v-else-if="error" class="flex min-h-80 items-center justify-center px-4">
        <div class="max-w-md rounded-xl border border-border bg-surface p-6 text-center">
          <p class="mb-2 text-base font-semibold leading-6 text-no">Profile unavailable</p>
          <p class="mb-4 text-sm leading-5 text-text-3">This profile could not be loaded from Polymarket right now.</p>
          <button class="pm-button pm-button--secondary pm-focus min-h-10 px-4 text-sm" @click="() => refresh()">Retry</button>
        </div>
      </div>

      <template v-else-if="profile && stats">
        <section class="pm-spring-in pm-panel overflow-hidden" style="--pm-spring-delay: 0ms">
          <div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
            <img :src="avatarSrc" :alt="displayName" class="h-18 w-18 shrink-0 rounded-full border border-border-2 bg-surface-2 object-cover" />
            <div class="min-w-0 flex-1">
              <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h1 class="min-w-0 truncate text-2xl font-extrabold leading-8 text-white">@{{ displayName }}</h1>
                <Icon v-if="profile.verifiedBadge" name="lucide:badge-check" class="h-4 w-4 shrink-0 text-yes" />
                <span v-if="profile.takerTierName" class="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-text-3">{{ profile.takerTierName }}</span>
              </div>
              <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4 text-text-3">
                <span>{{ formatJoinDate(profile.createdAt) }}</span>
                <span class="text-border-2">/</span>
                <span class="font-mono">{{ shortWallet(profile.proxyWallet) }}</span>
                <template v-if="profile.xUsername">
                  <span class="text-border-2">/</span>
                  <a :href="twitterHref" target="_blank" rel="noreferrer" class="pm-focus inline-flex items-center gap-1 rounded text-text-2 transition-colors duration-150 hover:text-white">
                    <Icon name="lucide:twitter" class="h-3.5 w-3.5" />
                    {{ profile.xUsername }}
                  </a>
                </template>
              </div>
              <p v-if="profile.bio" class="mt-3 max-w-3xl text-sm leading-5 text-text">{{ profile.bio }}</p>
            </div>
            <a :href="profileHref" target="_blank" rel="noreferrer" class="pm-focus inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-[12px] font-semibold text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white">
              <Icon name="lucide:external-link" class="h-3.5 w-3.5" />
              Polymarket
            </a>
          </div>
        </section>

        <section class="pm-spring-in mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" style="--pm-spring-delay: 70ms">
          <div class="pm-panel p-3">
            <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">Positions Value</div>
            <div class="font-mono mt-1 text-xl font-semibold leading-7 text-white">{{ money(stats.positionsValue) }}</div>
          </div>
          <div class="pm-panel p-3">
            <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">Open P/L</div>
            <div class="font-mono mt-1 text-xl font-semibold leading-7" :class="(stats.openPnl ?? 0) >= 0 ? 'text-yes' : 'text-no'">{{ signedMoney(stats.openPnl) }}</div>
          </div>
          <div class="pm-panel p-3">
            <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">Largest Open Win</div>
            <div class="font-mono mt-1 text-xl font-semibold leading-7 text-yes">{{ money(stats.largestOpenWin) }}</div>
          </div>
          <div class="pm-panel p-3">
            <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">Active Positions</div>
            <div class="font-mono mt-1 text-xl font-semibold leading-7 text-white">{{ stats.positions.toLocaleString() }}</div>
          </div>
        </section>

        <section class="pm-spring-in mt-4" style="--pm-spring-delay: 140ms">
          <div class="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border pb-3">
            <div class="flex gap-5" role="tablist" aria-label="Profile sections">
              <button id="profile-tab-positions" :class="tabClass('positions')" type="button" role="tab" :aria-selected="activeTab === 'positions'" aria-controls="profile-panel-positions" @click="activeTab = 'positions'">Positions</button>
              <button id="profile-tab-activity" :class="tabClass('activity')" type="button" role="tab" :aria-selected="activeTab === 'activity'" aria-controls="profile-panel-activity" @click="activeTab = 'activity'">Activity</button>
            </div>
            <label class="relative ml-auto flex min-w-52 items-center max-sm:w-full">
              <Icon name="lucide:search" class="pointer-events-none absolute left-2.5 h-3 w-3 text-text-3" />
              <span class="sr-only">Search profile rows</span>
              <input v-model="search" type="search" placeholder="Search" class="pm-focus h-8 w-full rounded-md border border-border bg-surface pl-8 pr-2.5 text-base text-text transition-colors duration-150 placeholder:text-text-3 focus:border-border-2 sm:text-xs" />
            </label>
          </div>

          <Transition
            mode="out-in"
            enter-active-class="transition-[opacity,transform] duration-[170ms] ease motion-reduce:transition-none"
            leave-active-class="transition-[opacity,transform] duration-[170ms] ease motion-reduce:transition-none"
            enter-from-class="opacity-0 translate-y-1.5"
            leave-to-class="opacity-0 translate-y-1.5"
          >
            <div v-if="activeTab === 'positions'" id="profile-panel-positions" key="positions" class="pm-panel overflow-hidden" role="tabpanel" aria-labelledby="profile-tab-positions">
              <div v-if="filteredPositions.length === 0" class="flex min-h-45 items-center justify-center px-6 py-12 text-center text-sm leading-5 text-text-3">No positions match this view.</div>
              <div v-else>
                <div class="hidden grid-cols-[minmax(240px,2.4fr)_80px_80px_80px_110px_120px] items-center gap-3 border-b border-border px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-text-3 lg:grid">
                  <span>Market</span>
                  <span>Outcome</span>
                  <span class="text-right">Avg</span>
                  <span class="text-right">Current</span>
                  <span class="text-right">Value</span>
                  <span class="text-right">P/L</span>
                </div>
                <ul>
                  <li v-for="position in filteredPositions" :key="position.asset || `${position.conditionId}-${position.outcome}`" class="border-b border-border last:border-b-0">
                    <NuxtLink :to="eventHref(position)" class="pm-focus grid gap-3 px-4 py-3 transition-colors duration-100 hover:bg-surface-2 lg:grid-cols-[minmax(240px,2.4fr)_80px_80px_80px_110px_120px] lg:items-center" :class="eventHref(position) ? '' : 'pointer-events-none'">
                      <div class="flex min-w-0 items-center gap-3">
                        <MarketIcon v-if="position.icon" :src="position.icon" :alt="position.title || 'Market'" class="h-9 w-9 shrink-0 rounded-lg border border-border object-cover" />
                        <div v-else class="h-9 w-9 shrink-0 rounded-lg border border-border bg-surface-2" />
                        <div class="min-w-0">
                          <div class="line-clamp-2 text-[13px] font-semibold leading-5 text-white">{{ position.title || "Untitled market" }}</div>
                          <div v-if="position.endDate" class="mt-0.5 text-[10.5px] leading-4 text-text-3">Ends {{ new Date(position.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }}</div>
                        </div>
                      </div>
                      <div class="flex items-center justify-between gap-3 lg:block">
                        <span class="text-[10px] font-bold uppercase tracking-widest text-text-3 lg:hidden">Outcome</span>
                        <span class="font-mono rounded-sm px-1.5 text-[10px] font-semibold leading-4" :class="String(position.outcome).toLowerCase() === 'yes' ? 'bg-yes-bg text-yes' : 'bg-no-bg text-no'">{{ position.outcome || "Outcome" }}</span>
                      </div>
                      <div class="font-mono flex items-center justify-between gap-3 text-xs text-text-2 lg:block lg:text-right">
                        <span class="font-sans text-[10px] font-bold uppercase tracking-widest text-text-3 lg:hidden">Avg</span>
                        {{ cents(position.avgPrice) }}
                      </div>
                      <div class="font-mono flex items-center justify-between gap-3 text-xs text-white lg:block lg:text-right">
                        <span class="font-sans text-[10px] font-bold uppercase tracking-widest text-text-3 lg:hidden">Current</span>
                        {{ cents(position.curPrice) }}
                      </div>
                      <div class="font-mono flex items-center justify-between gap-3 text-xs font-semibold text-white lg:block lg:text-right">
                        <span class="font-sans text-[10px] font-bold uppercase tracking-widest text-text-3 lg:hidden">Value</span>
                        {{ money(position.currentValue) }}
                      </div>
                      <div class="font-mono flex items-center justify-between gap-3 text-xs font-semibold lg:block lg:text-right" :class="(position.cashPnl ?? 0) >= 0 ? 'text-yes' : 'text-no'">
                        <span class="font-sans text-[10px] font-bold uppercase tracking-widest text-text-3 lg:hidden">P/L</span>
                        <span
                          >{{ signedMoney(position.cashPnl) }} <span class="text-[10px] opacity-80">({{ percent(position.percentPnl) }})</span></span
                        >
                      </div>
                    </NuxtLink>
                  </li>
                </ul>
              </div>
            </div>

            <div v-else id="profile-panel-activity" key="activity" class="pm-panel overflow-hidden" role="tabpanel" aria-labelledby="profile-tab-activity">
              <div v-if="filteredActivity.length === 0" class="flex min-h-45 items-center justify-center px-6 py-12 text-center text-sm leading-5 text-text-3">No activity matches this view.</div>
              <ul v-else>
                <li v-for="item in filteredActivity" :key="item.transactionHash || `${item.timestamp}-${item.type}-${item.title}`" class="border-b border-border last:border-b-0">
                  <div
                    class="pm-focus flex items-center gap-3 px-4 py-2.5 transition-colors duration-100 hover:bg-surface-2"
                    :class="eventHref(item) ? 'cursor-pointer' : ''"
                    :role="eventHref(item) ? 'link' : undefined"
                    :tabindex="eventHref(item) ? 0 : undefined"
                    @click="openActivity(item)"
                    @keydown.enter.prevent="openActivity(item)"
                    @keydown.space.prevent="openActivity(item)"
                  >
                    <span class="w-14 shrink-0 text-[9px] font-bold uppercase tracking-widest" :class="activityTypeClass(item)">{{ activityLabel(item) }}</span>
                    <MarketIcon v-if="item.icon" :src="item.icon" :alt="item.title || activityLabel(item)" class="h-8 w-8 shrink-0 rounded-md border border-border object-cover" />
                    <span v-else class="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-surface-2 text-text-3" :class="isYieldActivity(item) ? 'border-yes/25 bg-yes-bg text-yes' : ''">
                      <Icon :name="isYieldActivity(item) ? 'lucide:piggy-bank' : 'lucide:activity'" class="h-3.5 w-3.5" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-[12.5px] font-semibold leading-5 text-text">{{ activityTitle(item) }}</span>
                      <span class="mt-0.5 flex items-center gap-1.5">
                        <span v-if="item.outcome" class="font-mono rounded-sm px-1.5 text-[10px] font-semibold leading-4" :class="String(item.outcome).toLowerCase() === 'yes' ? 'bg-yes-bg text-yes' : 'bg-no-bg text-no'"
                          >{{ item.outcome }} <template v-if="item.price">{{ cents(item.price) }}</template></span
                        >
                        <span v-if="activitySubtitle(item)" class="font-mono text-[10.5px] leading-4 text-text-3">{{ activitySubtitle(item) }}</span>
                      </span>
                    </span>
                    <span class="flex shrink-0 items-center gap-2 text-right">
                      <span>
                        <span class="font-mono block whitespace-nowrap text-xs font-semibold leading-5 text-white">{{ money(activityAmount(item)) }}</span>
                        <span v-if="item.timestamp" class="block whitespace-nowrap text-[10px] leading-4 text-text-3">{{ formatRelativeTime(item.timestamp * 1000) }}</span>
                      </span>
                      <a v-if="explorerHref(item)" :href="explorerHref(item)" target="_blank" rel="noreferrer" class="pm-focus grid h-7 w-7 place-items-center rounded-md text-text-3 transition-colors duration-150 hover:bg-surface hover:text-white" aria-label="Open transaction on PolygonScan" @click.stop>
                        <Icon name="lucide:external-link" class="h-3.5 w-3.5" />
                      </a>
                    </span>
                  </div>
                </li>
              </ul>
            </div>
          </Transition>
        </section>
      </template>
    </main>
  </div>
</template>
