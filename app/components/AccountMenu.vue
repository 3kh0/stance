<script setup lang="ts">
const emit = defineEmits<{ "add-account": []; "link-wallet": [] }>();

const { account, accounts, activeAccountId, switchAccount, removeAccount } = useAccount();
const { current: theme, themes, setTheme } = useTheme();

const open = ref(false);
const container = ref<HTMLElement | null>(null);
const close = () => (open.value = false);
const toggle = () => (open.value = !open.value);
const onSelect = (id: string) => {
  switchAccount(id);
  close();
};
const onAdd = () => {
  close();
  emit("add-account");
};
const onLink = () => {
  close();
  emit("link-wallet");
};
const onRemove = () => {
  removeAccount(account.value.id);
  close();
};
const shortAddress = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const onDoc = (e: MouseEvent) => {
  if (container.value && !container.value.contains(e.target as Node)) close();
};
onMounted(() => document.addEventListener("click", onDoc));
onBeforeUnmount(() => document.removeEventListener("click", onDoc));
</script>

<template>
  <div ref="container" class="relative">
    <button class="pm-focus flex rounded-full" aria-haspopup="menu" :aria-expanded="open" aria-label="Account menu" @click="toggle">
      <img :src="account.wallet?.image || `/api/pfp?${account.wallet?.funder || account.username}`" alt="Profile Picture" class="h-8 w-8 rounded-full object-cover" />
    </button>

    <Transition name="account-menu">
      <div v-if="open" role="menu" class="absolute right-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-[10px] border border-border bg-(--color-card) shadow-2xl">
        <div class="border-b border-border px-3 py-2 text-(--text-meta) text-xs font-bold uppercase tracking-[0.12em]">Accounts</div>

        <div class="max-h-72 overflow-y-auto py-1">
          <button v-for="a in accounts" :key="a.id" role="menuitem" class="pm-focus flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-(--color-card-hover)" @click="onSelect(a.id)">
            <img :src="a.wallet?.image || `/api/pfp?${a.wallet?.funder || a.username}`" alt="" class="h-8 w-8 shrink-0 rounded-full object-cover" />
            <div class="min-w-0 flex-1">
              <div class="truncate text-(--text-primary) text-sm font-[590] leading-5">{{ a.username || shortAddress(a.wallet?.funder) }}</div>
              <div class="flex items-center gap-1.5 text-xs leading-4">
                <span v-if="a.kind === 'polymarket'" class="rounded-sm bg-(--color-primary-glow) px-1 py-px text-(--color-primary) font-[650]">Live</span>
                <span v-else class="rounded-sm bg-white/6 px-1 py-px text-(--text-meta) font-[650]">Paper</span>
                <span class="text-(--text-muted) tabular-nums">${{ a.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
              </div>
            </div>
            <Icon v-if="a.id === activeAccountId" name="lucide:check" class="h-4 w-4 shrink-0 text-(--color-primary)" />
          </button>
        </div>

        <div class="border-t border-border px-3 pb-1 pt-2 text-(--text-meta) text-xs font-bold uppercase tracking-[0.12em]">Theme</div>
        <div class="px-1.5 pb-1.5">
          <button
            v-for="t in themes"
            :key="t.id"
            role="menuitemradio"
            :aria-checked="t.id === theme"
            class="pm-focus flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-150"
            :class="t.id === theme ? 'bg-(--color-card-hover) text-(--text-primary)' : 'text-(--text-meta) hover:bg-(--color-card-hover) hover:text-(--text-primary)'"
            @click="setTheme(t.id)"
          >
            <span class="flex h-4 w-4 shrink-0 overflow-hidden rounded-full border border-border-2">
              <span v-for="(sw, i) in t.swatch" :key="i" class="h-full w-1/3" :style="{ background: sw }" />
            </span>
            <span class="flex-1 truncate text-sm font-[590] leading-5">{{ t.label }}</span>
            <Icon v-if="t.id === theme" name="lucide:check" class="h-4 w-4 shrink-0 text-(--color-primary)" />
          </button>
        </div>

        <div class="border-t border-border py-1">
          <button role="menuitem" class="pm-focus flex w-full items-center gap-2.5 px-3 py-2.5 text-(--text-meta) text-sm font-[590] leading-5 transition-colors duration-150 hover:bg-(--color-card-hover) hover:text-(--text-primary)" @click="onAdd">
            <Icon name="lucide:plus" class="h-4.5 w-4.5" />
            New paper account
          </button>
          <button role="menuitem" class="pm-focus flex w-full items-center gap-2.5 px-3 py-2.5 text-(--text-meta) text-sm font-[590] leading-5 transition-colors duration-150 hover:bg-(--color-card-hover) hover:text-(--text-primary)" @click="onLink">
            <Icon name="lucide:link" class="h-4.5 w-4.5" />
            Link Polymarket wallet
          </button>
          <button v-if="account.id" role="menuitem" class="pm-focus flex w-full items-center gap-2.5 px-3 py-2.5 text-(--market-no) text-sm font-[590] leading-5 transition-colors duration-150 hover:bg-(--market-no-bg)" @click="onRemove">
            <Icon name="lucide:log-out" class="h-4.5 w-4.5" />
            {{ account.kind === "polymarket" ? "Disconnect this account" : "Remove this account" }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.account-menu-enter-active,
.account-menu-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
}

.account-menu-enter-from,
.account-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .account-menu-enter-active,
  .account-menu-leave-active {
    transition: none;
  }
}
</style>
