<script setup lang="ts">
import { useAccount } from "~/composables/useAccount";
import { calculateMaxSellAmount } from "~/utils/markets";

const { account, isLiveAccount } = useAccount();
const { syncing } = usePolymarket();

const showDeposit = ref(false);
const showWithdraw = ref(false);

const walletShort = computed(() => {
  const f = account.value.wallet?.funder;
  return f ? `${f.slice(0, 6)}…${f.slice(-4)}` : "";
});

const openPositionValue = computed(() => account.value.positions.reduce((s, p) => s + calculateMaxSellAmount(p.shares, Math.round(p.currentPrice * 100)), 0));
const investedCost = computed(() => account.value.positions.reduce((s, p) => s + p.shares * p.entryPrice, 0));
const openPnl = computed(() => openPositionValue.value - investedCost.value);
const totalEquity = computed(() => account.value.balance + openPositionValue.value);
const netDeposits = computed(() =>
  account.value.transactions.reduce((s, t) => {
    if (t.type === "deposit") return s + (t.amount || 0);
    if (t.type === "withdraw") return s - (t.amount || 0);
    return s;
  }, 0),
);
const totalPnl = computed(() => (isLiveAccount.value ? openPnl.value : totalEquity.value - netDeposits.value));
const totalPnlPercent = computed(() => {
  if (isLiveAccount.value) return investedCost.value > 0 ? (openPnl.value / investedCost.value) * 100 : 0;
  return netDeposits.value > 0 ? (totalPnl.value / netDeposits.value) * 100 : 0;
});
</script>

<template>
  <section class="mb-5 overflow-hidden rounded-xl border border-border bg-border" aria-label="Portfolio summary">
    <div class="grid grid-cols-2 gap-px md:grid-cols-4">
      <div class="bg-surface px-4 py-3.5">
        <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">Equity</div>
        <div class="font-mono mt-1.5 text-lg font-semibold leading-6 text-white">
          <NumericOdometer :value="totalEquity" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" />
        </div>
      </div>
      <div class="bg-surface px-4 py-3.5">
        <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">Cash</div>
        <div class="font-mono mt-1.5 text-lg font-semibold leading-6 text-text">
          <NumericOdometer :value="account.balance" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" />
        </div>
      </div>
      <div class="bg-surface px-4 py-3.5">
        <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">Open value</div>
        <div class="font-mono mt-1.5 text-lg font-semibold leading-6 text-text">
          <NumericOdometer :value="openPositionValue" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" />
        </div>
      </div>
      <div class="bg-surface px-4 py-3.5">
        <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">{{ isLiveAccount ? "Open P&L" : "All-time P&L" }}</div>
        <div class="font-mono mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-lg font-semibold leading-6" :class="totalPnl >= 0 ? 'text-yes' : 'text-no'">
          <span class="whitespace-nowrap">{{ totalPnl >= 0 ? "+" : "−" }}<NumericOdometer :value="Math.abs(totalPnl)" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" /></span>
          <span class="text-[11px] font-medium leading-4"><NumericOdometer :value="Math.abs(totalPnlPercent)" :maximum-fraction-digits="2" prefix="(" suffix="%)" /></span>
        </div>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-surface px-4 py-2.5">
      <span v-if="isLiveAccount" class="rounded-sm border border-border-2 bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest leading-4 text-white" :title="account.wallet?.funder">Live · {{ walletShort }}</span>
      <span v-else class="text-[10px] font-bold uppercase tracking-widest text-text-3">Paper account</span>
      <span v-if="isLiveAccount && syncing" class="text-[10.5px] leading-4 text-text-3">Syncing…</span>
      <div class="ml-auto flex items-center gap-1.5">
        <button type="button" class="pm-focus h-8 rounded-md bg-accent px-3.5 text-xs font-bold text-accent-fg transition-[background-color,transform] duration-100 hover:bg-accent-hover active:scale-[0.98]" @click="showDeposit = true">Deposit</button>
        <button type="button" class="pm-focus h-8 rounded-md border border-border px-3.5 text-xs font-semibold text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white" @click="showWithdraw = true">Withdraw</button>
      </div>
    </div>

    <template v-if="isLiveAccount">
      <ModalLiveDeposit :is-open="showDeposit" @close="showDeposit = false" />
      <ModalLiveWithdraw :is-open="showWithdraw" @close="showWithdraw = false" />
    </template>
    <template v-else>
      <ModalAmount :is-open="showDeposit" type="deposit" @close="showDeposit = false" />
      <ModalAmount :is-open="showWithdraw" type="withdraw" @close="showWithdraw = false" />
    </template>
  </section>
</template>
