<script setup lang="ts">
const router = useRouter();
const { loadAccount, hasAccount } = useAccount();

const auth = ref(false);
const activeTab = ref<"positions" | "orders" | "history">("positions");

const tabClass = (t: "positions" | "orders" | "history") => ["pm-focus text-[11px] font-bold uppercase tracking-widest transition-colors duration-150 motion-reduce:transition-none", activeTab.value === t ? "text-white" : "text-text-3 hover:text-text-2"];

onMounted(() => {
  loadAccount();
  if (!hasAccount()) auth.value = true;
});

const quit = () => ((auth.value = false), router.push("/"));
</script>

<template>
  <div>
    <ModalSignin :is-open="auth" @close="quit" />

    <div v-if="hasAccount()" class="pm-container py-5">
      <div class="pm-spring-in" style="--pm-spring-delay: 0ms">
        <PortfolioHeader />
      </div>
      <div class="pm-spring-in" style="--pm-spring-delay: 100ms">
        <div class="mb-4 flex gap-5 border-b border-border pb-3" role="tablist" aria-label="Portfolio sections">
          <button id="portfolio-tab-positions" :class="tabClass('positions')" type="button" role="tab" :aria-selected="activeTab === 'positions'" aria-controls="portfolio-panel-positions" @click="activeTab = 'positions'">Positions</button>
          <button id="portfolio-tab-orders" :class="tabClass('orders')" type="button" role="tab" :aria-selected="activeTab === 'orders'" aria-controls="portfolio-panel-orders" @click="activeTab = 'orders'">Orders</button>
          <button id="portfolio-tab-history" :class="tabClass('history')" type="button" role="tab" :aria-selected="activeTab === 'history'" aria-controls="portfolio-panel-history" @click="activeTab = 'history'">History</button>
        </div>

        <Transition
          mode="out-in"
          enter-active-class="transition-[opacity,transform] duration-[170ms] ease motion-reduce:transition-none"
          leave-active-class="transition-[opacity,transform] duration-[170ms] ease motion-reduce:transition-none"
          enter-from-class="opacity-0 translate-y-1.5"
          leave-to-class="opacity-0 translate-y-1.5"
        >
          <div v-if="activeTab === 'positions'" id="portfolio-panel-positions" key="positions" role="tabpanel" aria-labelledby="portfolio-tab-positions">
            <PortfolioPositions />
          </div>
          <div v-else-if="activeTab === 'orders'" id="portfolio-panel-orders" key="orders" role="tabpanel" aria-labelledby="portfolio-tab-orders">
            <PortfolioOrders />
          </div>
          <div v-else id="portfolio-panel-history" key="history" role="tabpanel" aria-labelledby="portfolio-tab-history">
            <PortfolioHistory />
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>
