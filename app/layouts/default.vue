<script setup>
import { SIDEBAR_COLLAPSED_STORAGE_KEY } from "~/utils/constants";
import { CATEGORY_TABS, NAV_TABS } from "~/utils/navigation";

const route = useRoute();
const { account, activeAccountId, isLiveAccount, loadAccount, hasAccount, storageError, acknowledgeStorageError } = useAccount();
const { isOpen: signinOpen, mode: signinMode, openSignin, closeSignin } = useSigninModal();
const { syncLiveAccount } = usePolymarket();
const { reconnect } = useWallet();
const { load: loadTheme } = useTheme();
const sidebarCollapsed = useState("stance-sidebar-collapsed", () => false);
usePaperOrderMonitor();

const syncLive = () => {
  if (!isLiveAccount.value) return;
  reconnect().catch(() => {});
  syncLiveAccount().catch(() => {});
};

watch(activeAccountId, syncLive, { flush: "post" });

const navLinkBase = "pm-focus inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2.5 py-1 text-[13px] font-medium text-text-2 transition-colors duration-150 hover:text-white";
const navLinkActive = "text-white";
const isActive = (path) => route.path === path;
const { open: openPalette, close: closePalette, toggle: togglePalette } = useCommandPalette();
const canPersistSidebar = () => typeof localStorage !== "undefined";

function setSidebarCollapsed(value) {
  sidebarCollapsed.value = value;
  if (canPersistSidebar()) localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, value ? "1" : "0");
}

function onGlobalKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
    e.preventDefault();
    togglePalette();
  }
}

watch(() => route.fullPath, closePalette);

onMounted(() => {
  loadTheme();
  loadAccount();
  if (canPersistSidebar()) sidebarCollapsed.value = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1";
  syncLive();
  document.addEventListener("keydown", onGlobalKeydown);
});

onBeforeUnmount(() => document.removeEventListener("keydown", onGlobalKeydown));
</script>

<template>
  <div class="flex h-dvh flex-col bg-bg">
    <header class="relative z-30 flex h-12 shrink-0 items-center gap-3.5 border-b border-border bg-bg px-5">
      <NuxtLink href="/" class="group pm-focus flex shrink-0 items-center gap-2 text-[14.5px] font-bold tracking-[-0.4px] text-white">
        <StanceLogo :size="24" class="stance-logo--header" />
        <span class="max-[360px]:hidden">Stance</span>
      </NuxtLink>

      <div class="hidden h-5 w-px shrink-0 bg-border-2 md:block" />

      <nav class="pm-topnav hidden min-w-0 flex-1 items-center gap-px overflow-x-auto md:flex">
        <NuxtLink v-for="tab in NAV_TABS" :key="tab.to" :href="tab.to" :class="[navLinkBase, isActive(tab.to) && navLinkActive]">
          <Icon :name="tab.icon" class="h-3.5 w-3.5 shrink-0" />
          {{ tab.label }}
        </NuxtLink>

        <div class="mx-1.5 h-4 w-px shrink-0 bg-border-2" />

        <NuxtLink v-for="tab in CATEGORY_TABS" :key="tab.to" :href="tab.to" :class="[navLinkBase, isActive(tab.to) && navLinkActive]">
          <Icon :name="tab.icon" class="h-3.5 w-3.5 shrink-0" />
          {{ tab.label }}
        </NuxtLink>
      </nav>

      <button type="button" class="pm-search pm-focus group flex max-w-[55vw] items-center gap-2 rounded-md border border-border bg-surface py-1.5 pl-2.5 pr-2 text-text-3 transition-colors duration-150 hover:border-border-2 max-md:hidden" aria-label="Search markets" @click="openPalette">
        <Icon name="lucide:search" class="h-3.5 w-3.5 shrink-0" />
        <span class="flex-1 text-left text-[13px] leading-5">Search markets…</span>
        <kbd class="shrink-0 rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-medium text-text-3">⌘K</kbd>
      </button>

      <div class="flex shrink-0 items-center gap-2.5">
        <template v-if="hasAccount()">
          <NuxtLink href="/portfolio" class="pm-focus flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 transition-colors duration-150 hover:border-border-2">
            <span class="text-[11px] font-medium text-text-3">Portfolio</span>
            <span class="font-mono text-[13px] font-semibold leading-4 text-yes"><NumericOdometer :value="account.balance >= 1000 ? Math.floor(account.balance) : account.balance" prefix="$" :minimum-fraction-digits="account.balance >= 1000 ? 0 : 2" :maximum-fraction-digits="account.balance >= 1000 ? 0 : 2" /></span>
          </NuxtLink>
          <AccountMenu @add-account="openSignin('paper')" @link-wallet="openSignin('wallet')" />
        </template>
        <template v-else>
          <button class="pm-focus text-[13px] font-semibold text-text-2 transition-colors duration-150 hover:text-white" @click="openSignin('choose')">Log In</button>
          <button class="pm-button pm-button--primary pm-focus min-h-8 px-3 text-[13px]" @click="openSignin('choose')">Sign Up</button>
        </template>
      </div>
    </header>

    <div class="flex min-h-0 flex-1">
      <AppSidebar :collapsed="sidebarCollapsed" @update:collapsed="setSidebarCollapsed" />
      <main class="min-h-0 flex-1 overflow-y-auto max-md:pb-[calc(3.25rem+env(safe-area-inset-bottom))]">
        <slot />
      </main>
    </div>

    <MobileTabBar @search="openPalette" />

    <CommandPalette />

    <ModalSignin :is-open="signinOpen" :mode="signinMode" @close="closeSignin" />

    <Transition name="storage-toast">
      <div v-if="storageError" role="alert" class="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 max-md:bottom-[calc(4.25rem+env(safe-area-inset-bottom))]">
        <div class="flex items-center gap-3 max-w-md w-full rounded-xl border border-[rgba(234,179,8,0.4)] bg-[rgba(234,179,8,0.1)] px-4 py-3 text-[#eab308] text-sm shadow-lg">
          <Icon name="lucide:triangle-alert" class="w-5 h-5 shrink-0" />
          <span class="flex-1 leading-5">{{ storageError }}</span>
          <button class="pm-focus shrink-0 rounded-md px-2 py-1 text-xs font-[650] hover:bg-[rgba(234,179,8,0.15)]" @click="acknowledgeStorageError">Dismiss</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.pm-topnav {
  scrollbar-width: none;
}
.pm-topnav::-webkit-scrollbar {
  display: none;
}

.pm-search {
  width: 240px;
}
@media (max-width: 1100px) {
  .pm-search {
    width: 200px;
  }
}

.storage-toast-enter-active,
.storage-toast-leave-active {
  transition:
    opacity 240ms ease,
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}
.storage-toast-enter-from,
.storage-toast-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
