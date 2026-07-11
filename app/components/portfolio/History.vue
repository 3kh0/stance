<script setup lang="ts">
import { useAccount, type Transaction } from "~/composables/useAccount";
import { formatRelativeTime, transactionAmount } from "~/utils/markets";

const { account } = useAccount();
const LinkOrDiv = resolveComponent("NuxtLink");

const LABELS: Record<string, string> = { deposit: "Deposit", withdraw: "Withdraw", buy: "Buy", sell: "Sell", redeem: "Redeem" };
const POSITIVE = new Set(["deposit", "sell", "redeem"]);
const TRADE = new Set(["buy", "sell", "redeem"]);

const label = (t: string) => LABELS[t] ?? "Activity";
const marketLabel = (t: Transaction) => (t.type === "deposit" ? "Deposited funds" : t.type === "withdraw" ? "Withdrew funds" : t.marketName);
const isLink = (t: Transaction) => TRADE.has(t.type);
const isTrade = (t: Transaction) => t.outcome !== undefined && TRADE.has(t.type);
</script>

<template>
  <section class="pm-panel overflow-hidden" aria-labelledby="portfolio-history-title">
    <div class="flex min-h-13 items-center border-b border-border px-4">
      <div>
        <h2 id="portfolio-history-title" class="text-[13px] font-semibold text-white">History</h2>
        <p class="mt-0.5 text-[10.5px] text-text-3">Every trade, deposit, withdrawal, and redemption on this account.</p>
      </div>
    </div>
    <div v-if="account.transactions.length === 0" class="flex min-h-45 items-center justify-center px-6 py-12 text-center">
      <p class="text-sm leading-5 text-text-3">No transactions yet. Deposit funds to get started.</p>
    </div>
    <ul v-else>
      <li v-for="transaction in [...account.transactions].reverse()" :key="transaction.id" class="border-b border-border last:border-b-0">
        <component :is="isLink(transaction) ? LinkOrDiv : 'div'" :to="isLink(transaction) ? `/event/${transaction.marketId}` : undefined" class="flex items-center gap-3 px-4 py-2.5 transition-colors duration-100 hover:bg-surface-2" :class="isLink(transaction) ? 'pm-focus' : ''">
          <span class="w-13 shrink-0 text-[9px] font-bold uppercase tracking-widest" :class="POSITIVE.has(transaction.type) ? 'text-yes' : 'text-text-3'">{{ label(transaction.type) }}</span>
          <MarketIcon v-if="transaction.marketIcon" :src="transaction.marketIcon" :alt="transaction.marketName" class="h-8 w-8 shrink-0 rounded-md border border-border object-cover" />
          <span v-else class="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-surface-2 text-text-3">
            <Icon name="lucide:circle-dollar-sign" class="h-3.5 w-3.5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[12.5px] font-semibold leading-5 text-text">{{ marketLabel(transaction) }}</span>
            <span v-if="isTrade(transaction)" class="mt-0.5 flex items-center gap-1.5">
              <span class="font-mono rounded-sm px-1.5 text-[10px] font-semibold leading-4" :class="transaction.outcome === 'yes' ? 'bg-yes-bg text-yes' : 'bg-no-bg text-no'">
                {{ transaction.outcome === "yes" ? "Yes" : "No" }}
                <NumericOdometer :value="transaction.price ? transaction.price * 100 : 0" :maximum-fraction-digits="1" suffix="¢" />
              </span>
              <span class="font-mono text-[10.5px] leading-4 text-text-3"><NumericOdometer :value="transaction.shares || 0" :maximum-fraction-digits="2" /> sh</span>
            </span>
          </span>
          <span class="shrink-0 text-right">
            <span class="font-mono block whitespace-nowrap text-xs font-semibold leading-5" :class="POSITIVE.has(transaction.type) ? 'text-yes' : 'text-no'">
              {{ POSITIVE.has(transaction.type) ? "+" : "−" }}<NumericOdometer :value="Math.abs(transactionAmount(transaction))" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" />
            </span>
            <span class="block whitespace-nowrap text-[10px] leading-4 text-text-3">{{ formatRelativeTime(transaction.timestamp) }}</span>
          </span>
        </component>
      </li>
    </ul>
  </section>
</template>
