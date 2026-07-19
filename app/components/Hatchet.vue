<template>
  <div class="hatchet overflow-hidden bg-surface" :class="embedded ? 'relative' : 'sticky top-4 rounded-xl border border-border'">
    <div class="flex items-center gap-2.5 border-b border-border px-3.5 py-3">
      <MarketIcon v-if="marketIcon" :src="marketIcon" :alt="marketTitle" class="h-9 w-9 shrink-0 rounded-md border border-border object-cover" />
      <div class="min-w-0 flex-1">
        <div class="truncate text-[12.5px] font-semibold leading-tight text-white">{{ marketTitle }}</div>
        <div class="mt-0.5 flex items-center gap-1.5">
          <span class="truncate text-[10px] font-bold uppercase tracking-widest" :class="selectedOutcome === 'yes' ? 'text-yes' : 'text-no'" :style="sideTextStyle(selectedOutcome)">{{ selectedOutcomeLabel }}</span>
          <span class="font-mono text-[11px] leading-none text-text-2"><NumericOdometer :value="currentPrice" suffix="¢" /></span>
        </div>
      </div>
      <span v-if="isLiveAccount" class="shrink-0 rounded-sm border border-border-2 bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest leading-4 text-white" title="Orders on this account trade real funds on Polymarket">Live</span>
    </div>

    <div class="grid grid-cols-2 border-b border-border">
      <button class="hatchet__tab pm-focus relative h-10 text-[11px] font-bold uppercase tracking-widest transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50" :class="orderType === 'buy' ? 'hatchet__tab--active text-yes' : 'text-text-3 hover:text-text-2'" @click="orderType = 'buy'">
        Buy
      </button>
      <button
        :disabled="!userPosition || userPosition.shares === 0"
        class="hatchet__tab pm-focus relative h-10 text-[11px] font-bold uppercase tracking-widest transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
        :class="orderType === 'sell' ? 'hatchet__tab--active text-no' : 'text-text-3 hover:text-text-2'"
        @click="orderType = 'sell'"
      >
        Sell
        <span v-if="userPosition && userPosition.shares > 0" class="font-mono ml-1 normal-case tracking-normal">(<NumericOdometer :value="userPosition.shares" :maximum-fraction-digits="2" />)</span>
      </button>
    </div>

    <div class="hatchet__body flex flex-col gap-3.5 p-3.5">
      <div>
        <div class="mb-1.5 flex items-center justify-between">
          <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">Outcome</div>
          <div class="flex gap-0.5 rounded-md border border-border p-0.5" role="group" aria-label="Order type">
            <button class="pm-focus h-5.5 rounded px-2 text-[9px] font-bold uppercase tracking-widest transition-colors duration-150" :class="orderMode === 'market' ? 'bg-surface-2 text-white' : 'text-text-3 hover:text-text-2'" @click="setOrderMode('market')">Market</button>
            <button class="pm-focus h-5.5 rounded px-2 text-[9px] font-bold uppercase tracking-widest transition-colors duration-150" :class="orderMode === 'limit' ? 'bg-surface-2 text-white' : 'text-text-3 hover:text-text-2'" @click="setOrderMode('limit')">Limit</button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-1.5">
          <button
            class="pm-focus flex h-10 items-center justify-between rounded-md border px-3 transition-colors duration-150 active:scale-[0.98]"
            :class="selectedOutcome === 'yes' ? 'border-yes/40 bg-yes-bg text-yes' : 'border-border text-text-2 hover:border-border-2 hover:text-text'"
            :style="selectedOutcome === 'yes' ? sideButtonStyle('yes') : undefined"
            @click="selectOutcome('yes')"
          >
            <span class="truncate pr-2 text-xs font-bold" :title="yesLabel">{{ yesLabel }}</span>
            <span class="font-mono text-xs font-semibold"><NumericOdometer :value="yesPrice" suffix="¢" /></span>
          </button>
          <button
            class="pm-focus flex h-10 items-center justify-between rounded-md border px-3 transition-colors duration-150 active:scale-[0.98]"
            :class="selectedOutcome === 'no' ? 'border-no/40 bg-no-bg text-no' : 'border-border text-text-2 hover:border-border-2 hover:text-text'"
            :style="selectedOutcome === 'no' ? sideButtonStyle('no') : undefined"
            @click="selectOutcome('no')"
          >
            <span class="truncate pr-2 text-xs font-bold" :title="noLabel">{{ noLabel }}</span>
            <span class="font-mono text-xs font-semibold"><NumericOdometer :value="noPrice" suffix="¢" /></span>
          </button>
        </div>
      </div>

      <div v-if="orderMode === 'market'">
        <div class="mb-1.5 flex items-baseline justify-between">
          <label class="text-[10px] font-bold uppercase tracking-widest text-text-3">{{ marketInputIsShares ? "Shares" : "Amount" }}</label>
          <div v-if="account" class="text-[10px] uppercase tracking-wide text-text-3">
            <template v-if="marketInputIsShares"
              >Avail <span class="font-mono normal-case text-text-2"><NumericOdometer :value="sellableShares" :maximum-fraction-digits="4" /></span
            ></template>
            <template v-else
              >Bal <span class="font-mono normal-case text-text-2"><NumericOdometer :value="account.balance" prefix="$" :maximum-fraction-digits="2" /></span
            ></template>
          </div>
        </div>
        <div class="hatchet__amount-input flex h-11 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 transition-colors duration-150 focus-within:border-border-2" :class="{ 'hatchet__amount-input--bounce': numberBounce }">
          <span v-if="!marketInputIsShares" class="hatchet__currency font-mono shrink-0 select-none text-sm font-semibold text-text-3">$</span>
          <input v-model="amountInput" type="text" inputmode="decimal" :max="marketInputIsShares ? sellableShares : undefined" class="pm-focus font-mono min-w-0 flex-1 bg-transparent text-right text-base font-semibold text-white" placeholder="0.00" @focus="inputFocused = true" @blur="inputFocused = false" />
          <span class="shrink-0 text-[9px] font-bold tracking-widest text-text-3">{{ marketInputIsShares ? "SH" : "USD" }}</span>
        </div>
        <div class="mt-1.5 grid grid-cols-4 gap-1.5">
          <button class="pm-focus font-mono h-7 rounded-md border border-border text-[11px] font-medium text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white" @click="bumpAmount(1)">+1</button>
          <button class="pm-focus font-mono h-7 rounded-md border border-border text-[11px] font-medium text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white" @click="bumpAmount(20)">+20</button>
          <button class="pm-focus font-mono h-7 rounded-md border border-border text-[11px] font-medium text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white" @click="bumpAmount(100)">+100</button>
          <button class="pm-focus h-7 rounded-md border border-border text-[10px] font-bold uppercase tracking-widest text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white" @click="setMaxAmount">Max</button>
        </div>
      </div>

      <div v-else class="flex flex-col gap-3">
        <div>
          <div class="mb-1.5 flex items-baseline justify-between">
            <label class="text-[10px] font-bold uppercase tracking-widest text-text-3">Limit price</label>
            <div v-if="account" class="text-[10px] uppercase tracking-wide text-text-3">
              Bal <span class="font-mono normal-case text-text-2"><NumericOdometer :value="account.balance" prefix="$" :maximum-fraction-digits="2" /></span>
            </div>
          </div>
          <div class="flex h-11 items-stretch gap-1.5">
            <button class="pm-focus font-mono w-11 shrink-0 rounded-md border border-border text-base font-semibold text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white" aria-label="Decrease limit price" @click="stepLimitPrice(-1)">−</button>
            <div class="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 transition-colors duration-150 focus-within:border-border-2">
              <input v-model="limitPriceInput" type="text" inputmode="decimal" class="pm-focus font-mono min-w-0 flex-1 bg-transparent text-right text-base font-semibold text-white" placeholder="0" aria-label="Limit price in cents" @blur="normalizeLimitPrice" />
              <span class="shrink-0 select-none text-[9px] font-bold tracking-widest text-text-3">¢</span>
            </div>
            <button class="pm-focus font-mono w-11 shrink-0 rounded-md border border-border text-base font-semibold text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white" aria-label="Increase limit price" @click="stepLimitPrice(1)">+</button>
          </div>
        </div>

        <div>
          <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-text-3">Shares</label>
          <div class="flex h-11 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 transition-colors duration-150 focus-within:border-border-2">
            <input v-model="limitSharesInput" type="text" inputmode="decimal" class="pm-focus font-mono min-w-0 flex-1 bg-transparent text-right text-base font-semibold text-white" placeholder="0" aria-label="Number of shares" />
            <span class="shrink-0 select-none text-[9px] font-bold tracking-widest text-text-3">SH</span>
          </div>
          <div class="mt-1.5 grid grid-cols-4 gap-1.5">
            <button class="pm-focus font-mono h-7 rounded-md border border-border text-[11px] font-medium text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white" @click="bumpLimitShares(10)">+10</button>
            <button class="pm-focus font-mono h-7 rounded-md border border-border text-[11px] font-medium text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white" @click="bumpLimitShares(100)">+100</button>
            <button class="pm-focus font-mono h-7 rounded-md border border-border text-[11px] font-medium text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white" @click="bumpLimitShares(1000)">+1k</button>
            <button class="pm-focus h-7 rounded-md border border-border text-[10px] font-bold uppercase tracking-widest text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white" @click="setMaxLimitShares">Max</button>
          </div>
        </div>

        <label class="flex cursor-pointer items-start gap-2">
          <input v-model="postOnly" type="checkbox" class="pm-focus mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-yes" />
          <span class="flex min-w-0 flex-col gap-0.5">
            <span class="text-[11px] font-semibold leading-4 text-text">Post only</span>
            <span class="text-[10.5px] leading-relaxed text-text-3">When enabled, a limit order that would fill immediately is rejected so it always rests on the book as a maker order.</span>
          </span>
        </label>

        <div v-if="matchingShares > 0" class="inline-flex h-6 w-fit items-center rounded-sm border border-yes/30 bg-yes-bg px-2">
          <span class="font-mono text-[11px] font-bold tabular-nums text-yes">{{ fmts(matchingShares) }}</span>
          <span class="ml-1.5 text-[9px] font-bold uppercase tracking-widest text-yes">matching</span>
        </div>
      </div>

      <div class="flex flex-col gap-1.5 border-t border-border pt-3">
        <div class="flex items-center justify-between">
          <span class="text-[11px] text-text-2">{{ orderMode === "market" ? "Avg price" : "Limit price" }}</span>
          <span class="font-mono text-xs font-semibold text-text"><NumericOdometer :value="summaryPriceCents" suffix="¢" :maximum-fraction-digits="1" /></span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[11px] text-text-2">{{ orderMode === "market" && orderType === "buy" ? "Est. shares" : "Shares" }}</span>
          <span class="font-mono text-xs font-semibold text-text"><NumericOdometer :value="summaryShares" :maximum-fraction-digits="2" /></span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[11px] text-text-2">{{ orderMode === "limit" ? "Total" : "Amount" }}</span>
          <span class="font-mono text-xs font-semibold text-text"><NumericOdometer :value="orderCost" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" /></span>
        </div>
        <div v-if="feeUsd > 0 || (orderMode === 'limit' && !feeIsTaker)" class="flex items-center justify-between">
          <span class="text-[11px] text-text-2">Est. fee</span>
          <span v-if="feeUsd > 0" class="font-mono text-xs font-semibold text-text"><NumericOdometer :value="feeUsd" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" /></span>
          <span v-else class="text-[11px] font-semibold text-text-3">No fee (maker)</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[11px] text-text-2">{{ orderType === "buy" ? "To win" : "You'll receive" }}</span>
          <span class="font-mono text-lg font-semibold leading-6 text-yes" :style="sideTextStyle(selectedOutcome)"><NumericOdometer :value="payoutNumber" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" /></span>
        </div>
      </div>

      <div v-if="actionError" class="rounded-md border border-[rgba(254,154,0,0.25)] bg-[rgba(254,154,0,0.08)] px-3 py-2 text-center text-[11px] font-semibold leading-4 text-(--market-warning)" role="alert">{{ actionError }}</div>

      <div v-if="placedNotice" class="rounded-md border border-border-2 bg-surface-2 px-3 py-2 text-center text-[11px] font-semibold leading-4 text-text" role="status">{{ placedNotice }}</div>

      <button
        :disabled="!!actionError"
        class="pm-focus h-12 w-full shrink-0 rounded-md border text-sm font-bold transition-[background-color,transform] duration-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
        :class="selectedOutcome === 'yes' ? 'border-yes/30 bg-yes-hover text-yes hover:bg-yes/25' : 'border-no/25 bg-no-hover text-no hover:bg-no/25'"
        :style="sideActionStyle(selectedOutcome)"
        @click="openConfirmation"
      >
        <template v-if="orderMode === 'limit' && !isMarketableLimit">Limit {{ orderType }} {{ selectedOutcomeLabel }}</template>
        <template v-else>{{ orderType === "buy" ? "Buy" : "Sell" }} {{ selectedOutcomeLabel }}</template>
        <span class="font-mono font-semibold">· <NumericOdometer :value="orderCost" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" /></span>
      </button>
    </div>

    <Transition name="trade-confirm">
      <div v-if="showConfirmation" ref="confirmationEl" class="absolute inset-0 z-10 flex flex-col overflow-y-auto rounded-xl bg-surface p-5" role="dialog" aria-modal="true" aria-labelledby="hatchet-confirm-title" tabindex="-1" @keydown="onConfirmKeydown">
        <div class="mb-4 flex items-center gap-2 border-b border-border pb-3">
          <button ref="backButtonEl" class="pm-focus -ml-1 grid h-7 w-7 place-items-center rounded-md text-text-2 transition-colors duration-150 hover:text-white" aria-label="Back to order form" @click="closeConfirmation">
            <Icon name="lucide:chevron-left" class="h-4 w-4" />
          </button>
          <h2 id="hatchet-confirm-title" class="text-[10px] font-bold uppercase tracking-widest text-text-3">Confirm {{ confirmedMode === "limit" ? "limit order" : "order" }}</h2>
        </div>

        <div class="mb-4">
          <div class="text-[12.5px] font-semibold leading-snug text-white">{{ marketTitle }}</div>
          <div class="mt-1 flex items-center gap-1.5">
            <span class="text-[10px] font-bold uppercase tracking-widest" :class="orderType === 'buy' ? 'text-yes' : 'text-no'">{{ orderType }}</span>
            <span class="text-[10px] font-bold uppercase tracking-widest" :class="selectedOutcome === 'yes' ? 'text-yes' : 'text-no'" :style="sideTextStyle(selectedOutcome)">{{ selectedOutcomeLabel }}</span>
            <span v-if="confirmedMode === 'limit'" class="rounded-sm border border-border-2 px-1 text-[9px] font-bold uppercase tracking-widest leading-4 text-text-2">Limit</span>
            <span v-if="confirmedMode === 'limit' && confirmedPostOnly" class="rounded-sm border border-border-2 px-1 text-[9px] font-bold uppercase tracking-widest leading-4 text-text-2">Post only</span>
          </div>
        </div>

        <div class="mb-4 flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3">
          <div class="flex items-center justify-between">
            <span class="text-[11px] text-text-2">{{ confirmedMode === "limit" ? "Limit price" : "Avg price" }}</span>
            <span class="font-mono text-xs font-semibold text-text"><NumericOdometer :value="confirmedPrice" suffix="¢" :maximum-fraction-digits="1" /></span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[11px] text-text-2">Shares</span>
            <span class="font-mono text-xs font-semibold text-text"><NumericOdometer :value="confirmedShares" :maximum-fraction-digits="2" /></span>
          </div>
          <div v-if="confirmedFee > 0" class="flex items-center justify-between">
            <span class="text-[11px] text-text-2">Est. fee</span>
            <span class="font-mono text-xs font-semibold text-text"><NumericOdometer :value="confirmedFee" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" /></span>
          </div>
          <div class="flex items-center justify-between border-t border-border pt-2">
            <span class="text-[11px] font-semibold text-text">Total</span>
            <span class="font-mono text-sm font-semibold text-white"><NumericOdometer :value="confirmedTotal" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" /></span>
          </div>
          <div v-if="orderType === 'buy'" class="flex items-center justify-between">
            <span class="text-[11px] font-semibold text-text">To win</span>
            <span class="font-mono text-sm font-semibold text-yes" :style="sideTextStyle(selectedOutcome)"><NumericOdometer :value="confirmedShares" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" /></span>
          </div>
          <div v-else-if="confirmedFee > 0" class="flex items-center justify-between">
            <span class="text-[11px] font-semibold text-text">You'll receive</span>
            <span class="font-mono text-sm font-semibold text-yes"><NumericOdometer :value="Math.max(previewSnapshot.amount - confirmedFee, 0)" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" /></span>
          </div>
        </div>

        <p v-if="isLiveAccount && confirmedMode === 'limit'" class="mb-4 text-[10.5px] leading-relaxed text-text-3">This places a real limit order on Polymarket with your funds. Your wallet will ask you to sign it. If it doesn't fill immediately, it rests on the book until filled or cancelled.</p>
        <p v-else-if="isLiveAccount" class="mb-4 text-[10.5px] leading-relaxed text-text-3">This places a real order on Polymarket with your funds. Your wallet will ask you to sign it. Once filled, the trade is not reversible.</p>
        <p v-else-if="confirmedMode === 'limit' && !confirmedMarketable" class="mb-4 text-[10.5px] leading-relaxed text-text-3">
          This order will rest in the book and fill automatically when the market reaches your price. {{ orderType === "buy" ? "The total is held from your balance until then." : "The shares stay committed until it fills." }} You can cancel it anytime.
        </p>
        <p v-else class="mb-4 text-[10.5px] leading-relaxed text-text-3">Prices may change frequently. Once executed, the transaction is not reversible.</p>

        <div v-if="liveError" class="mb-3 rounded-md border border-no/25 bg-no-bg px-3 py-2 text-center text-[11px] font-semibold leading-4 text-no" role="alert">{{ liveError }}</div>

        <button
          ref="executeButtonEl"
          :disabled="isExecuting"
          class="pm-focus mt-auto h-12 w-full rounded-md border text-sm font-bold transition-[background-color,transform] duration-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          :class="orderType === 'buy' ? 'border-yes/30 bg-yes-hover text-yes hover:bg-yes/25' : 'border-no/25 bg-no-hover text-no hover:bg-no/25'"
          :style="sideActionStyle(selectedOutcome)"
          @click="executeOrder"
        >
          <template v-if="isExecuting">{{ isLiveAccount ? "Confirm in your wallet..." : "Executing..." }}</template>
          <template v-else-if="confirmedMode === 'limit' && !confirmedMarketable">
            Place limit order ·
            <span class="font-mono font-semibold"><NumericOdometer :value="previewSnapshot.amount" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" /></span>
          </template>
          <template v-else>
            {{ orderType === "buy" ? "Buy" : "Sell" }} for
            <span class="font-mono font-semibold"><NumericOdometer :value="previewSnapshot.amount" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" /></span>
          </template>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { Outcome, OrderSide } from "~/types/account";
import type { ClobFeeInfo } from "~/composables/usePolymarket";
import { useHatchetExecution } from "~/composables/useHatchetExecution";
import { SHARE_EPSILON } from "~/utils/constants";
import { fmts } from "~/utils/prices";
import { calculateMaxSellAmount, calculateShares, clampLimitPriceCents, clobFeeUsd, createTradePreviewSnapshot, createTradePreviewSnapshotFromShares, limitOrderCost, positionKey, type BookLevelSelection, type TradePreviewSnapshot } from "~/utils/markets";

interface Props {
  marketIcon?: string;
  marketTitle: string;
  marketQuestion?: string;
  marketId?: string;
  marketSlug?: string;
  yesLabel?: string;
  noLabel?: string;
  yesPrice: number;
  noPrice: number;
  maxAmount?: number;
  preselectedOutcome?: Outcome;
  hasAsks?: boolean;
  bestAskCents?: number | null;
  bestBidCents?: number | null;
  conditionId?: string;
  yesTokenId?: string;
  noTokenId?: string;
  negRisk?: boolean;
  tickSize?: number;
  yesColor?: string;
  noColor?: string;
  embedded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  marketIcon: undefined,
  marketQuestion: undefined,
  marketSlug: undefined,
  yesLabel: "Yes",
  noLabel: "No",
  maxAmount: 1000,
  preselectedOutcome: undefined,
  marketId: "",
  bestAskCents: undefined,
  bestBidCents: undefined,
  conditionId: undefined,
  yesTokenId: undefined,
  noTokenId: undefined,
  negRisk: false,
  tickSize: undefined,
  yesColor: undefined,
  noColor: undefined,
  embedded: false,
});

const emit = defineEmits<{
  trade: [
    {
      type: OrderSide;
      outcome: Outcome;
      amount: number;
      shares: number;
      price: number;
      marketId: string;
      marketName: string;
    },
  ];
  "order-placed": [];
  "outcome-change": [outcome: Outcome];
}>();

const { account, isLiveAccount, createOrUpdatePosition, sellPosition, addTransaction, saveAccount, placeOpenOrder, availableShares, hasAccount } = useAccount();
const { openSignin } = useSigninModal();
const { placeLiveOrder, placeLiveLimitOrder, syncLiveAccount, getFeeInfo } = usePolymarket();

const orderType = ref<OrderSide>("buy");
const orderMode = ref<"market" | "limit">("market");
const selectedOutcome = ref<Outcome>("yes");
const amount = ref(100);
const limitPriceCents = ref(0);
const limitShares = ref(0);
const postOnly = ref(false);
const bookSelection = ref<BookLevelSelection | null>(null);
const placedNotice = ref<string | null>(null);
const showConfirmation = ref(false);
const numberBounce = ref(false);
const inputFocused = ref(false);
const confirmationEl = ref<HTMLElement | null>(null);
const backButtonEl = ref<HTMLButtonElement | null>(null);
const executeButtonEl = ref<HTMLButtonElement | null>(null);
const previousFocusEl = ref<HTMLElement | null>(null);
const isExecuting = ref(false);
const liveError = ref<string | null>(null);

const confirmedPrice = ref(0);
const confirmedShares = ref(0);
const confirmedMode = ref<"market" | "limit">("market");
const confirmedFee = ref(0);
const confirmedMarketable = ref(true);
const confirmedPostOnly = ref(false);
const confirmedFillPriceCents = ref(0);
const previewSnapshot = ref<TradePreviewSnapshot>({ amount: 0, priceCents: 0, shares: 0 });

let bounceTimer: ReturnType<typeof setTimeout>;

const amountInput = ref(amount.value > 0 ? String(amount.value) : "");
const limitPriceInput = ref("");
const limitSharesInput = ref("");

const cleanDecimal = (s: string) => s.replace(/[^0-9.]/g, "");
const parseDecimal = (s: string) => {
  const c = cleanDecimal(s);
  if (c === "") return 0;
  const n = Number.parseFloat(c);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const asInput = (n: number) => (n > 0 ? String(n) : "");

function bindDecimal(input: Ref<string>, set: (n: number) => void) {
  watch(input, (raw) => {
    const c = cleanDecimal(raw);
    if (c !== raw) {
      input.value = c;
      return;
    }
    set(parseDecimal(c));
  });
}

bindDecimal(amountInput, (n) => (amount.value = n));
bindDecimal(limitPriceInput, (n) => (limitPriceCents.value = n));
bindDecimal(limitSharesInput, (n) => (limitShares.value = Math.floor(n * 100) / 100));

watch(amount, (n) => {
  if (parseDecimal(amountInput.value) !== n) amountInput.value = asInput(n);
  if (inputFocused.value) return;
  numberBounce.value = false;
  clearTimeout(bounceTimer);
  nextTick(() => {
    numberBounce.value = true;
    bounceTimer = setTimeout(() => (numberBounce.value = false), 300);
  });
});
watch(limitPriceCents, (n) => {
  if (parseDecimal(limitPriceInput.value) !== n) limitPriceInput.value = asInput(n);
});
watch(limitShares, (n) => {
  if (parseDecimal(limitSharesInput.value) !== n) limitSharesInput.value = asInput(n);
});

if (props.preselectedOutcome) selectedOutcome.value = props.preselectedOutcome;
watch(
  () => props.preselectedOutcome,
  (o) => {
    if (o) selectedOutcome.value = o;
  },
);
watch(selectedOutcome, () => (bookSelection.value = null));

const currentPrice = computed(() => (selectedOutcome.value === "yes" ? props.yesPrice : props.noPrice));
const selectedOutcomeLabel = computed(() => (selectedOutcome.value === "yes" ? props.yesLabel : props.noLabel));

function customColor(side: Outcome): string | undefined {
  const c = side === "yes" ? props.yesColor : props.noColor;
  return c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : undefined;
}

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;
}

function sideStyle(side: Outcome, borderA: number, bgA: number) {
  const c = customColor(side);
  return c ? { color: c, borderColor: hexToRgba(c, borderA), backgroundColor: hexToRgba(c, bgA) } : undefined;
}
const sideTextStyle = (side: Outcome) => {
  const c = customColor(side);
  return c ? { color: c } : undefined;
};
const sideButtonStyle = (side: Outcome) => sideStyle(side, 0.6, 0.16);
const sideActionStyle = (side: Outcome) => sideStyle(side, 0.65, 0.22);

const marketInputIsShares = computed(() => orderMode.value === "market" && orderType.value === "sell");
const shares = computed(() => (marketInputIsShares.value ? amount.value : calculateShares(amount.value, currentPrice.value)));

const tickCents = computed(() => {
  const t = props.tickSize;
  return t && [0.1, 0.01, 0.005, 0.0025, 0.001, 0.0001].includes(t) ? t * 100 : 1;
});

const summaryPriceCents = computed(() => (orderMode.value === "market" ? currentPrice.value : limitPriceCents.value));
const summaryShares = computed(() => (orderMode.value === "market" ? shares.value : limitShares.value));
const orderCost = computed(() => {
  if (orderMode.value === "limit") return limitOrderCost(limitPriceCents.value, limitShares.value);
  return orderType.value === "sell" ? calculateMaxSellAmount(shares.value, currentPrice.value) : amount.value;
});

const feeInfo = ref<ClobFeeInfo>({ rate: 0, exponent: 0 });
watch(
  () => props.conditionId,
  async (conditionId) => {
    feeInfo.value = { rate: 0, exponent: 0 };
    if (!conditionId) return;
    try {
      feeInfo.value = await getFeeInfo(conditionId);
    } catch {}
  },
  { immediate: true },
);
const positionMarketId = computed(() => (isLiveAccount.value ? props.conditionId || "" : props.marketId));
const userPosition = computed(() => (!positionMarketId.value ? null : account.value.positions.find((p) => p.positionKey === positionKey(positionMarketId.value, selectedOutcome.value))));
const sellableShares = computed(() => {
  if (!userPosition.value) return 0;
  return isLiveAccount.value ? userPosition.value.shares : availableShares(positionMarketId.value, selectedOutcome.value);
});

watch(
  [() => userPosition.value?.shares ?? 0, orderType],
  ([s]) => {
    if (orderType.value === "sell" && s <= 0) orderType.value = "buy";
  },
  { immediate: true },
);

const noSharesForSale = computed(() => orderType.value === "buy" && orderMode.value === "market" && (props.hasAsks === false || currentPrice.value <= 0));
const liveTradingReady = computed(() => !!(props.conditionId && props.yesTokenId && props.noTokenId));
const isMarketableLimit = computed(() => {
  if (orderMode.value !== "limit" || limitPriceCents.value <= 0) return false;
  if (orderType.value === "buy") return props.bestAskCents != null && props.bestAskCents > 0 && limitPriceCents.value >= props.bestAskCents - SHARE_EPSILON;
  return props.bestBidCents != null && props.bestBidCents > 0 && limitPriceCents.value <= props.bestBidCents + SHARE_EPSILON;
});
const matchingShares = computed(() => {
  if (!bookSelection.value || !isMarketableLimit.value) return 0;
  if (Math.abs(limitPriceCents.value - bookSelection.value.priceCents) > SHARE_EPSILON) return 0;
  if (orderType.value === "buy" && bookSelection.value.side === "ask") return bookSelection.value.shares;
  if (orderType.value === "sell" && bookSelection.value.side === "bid") return bookSelection.value.shares;
  return 0;
});
const marketableFillPriceCents = computed(() => (orderType.value === "buy" ? Math.min(props.bestAskCents ?? limitPriceCents.value, limitPriceCents.value) : Math.max(props.bestBidCents ?? limitPriceCents.value, limitPriceCents.value)));

const feeIsTaker = computed(() => (orderMode.value === "market" ? true : isMarketableLimit.value && !postOnly.value));
const feeUsd = computed(() => (!feeIsTaker.value ? 0 : clobFeeUsd(feeInfo.value.rate, feeInfo.value.exponent, (orderMode.value === "limit" ? marketableFillPriceCents.value : summaryPriceCents.value) / 100, summaryShares.value)));
const payoutNumber = computed(() => (orderType.value === "buy" ? summaryShares.value : Math.max(orderCost.value - feeUsd.value, 0)));

const orderError = computed<string | null>(() => {
  if (!props.marketId) return "Market unavailable";
  if (isLiveAccount.value && !liveTradingReady.value) return "Live trading unavailable for this market";
  if (orderMode.value === "limit") {
    if (!(limitPriceCents.value > 0) || limitPriceCents.value >= 100) return "Enter a limit price";
    if (limitShares.value <= 0) return "Enter shares";
    if (postOnly.value && isMarketableLimit.value) return "Post only: order would fill immediately";
    if (orderType.value === "buy") return orderCost.value + feeUsd.value > account.value.balance ? "Not enough balance" : null;
    if (limitShares.value > sellableShares.value + SHARE_EPSILON) return sellableShares.value > 0 ? "Not enough uncommitted shares" : "No position to sell";
    return null;
  }
  if (noSharesForSale.value) return "No shares are for sale";
  if (!Number.isFinite(amount.value) || amount.value <= 0) return orderType.value === "sell" ? "Enter shares" : "Enter an amount";
  if (currentPrice.value <= 0) return "Price unavailable";
  if (shares.value <= 0) return orderType.value === "sell" ? "Enter shares" : "Amount too small";
  if (orderType.value === "buy") return amount.value + feeUsd.value > account.value.balance ? "Not enough balance" : null;
  if (sellableShares.value <= 0) return "No position to sell";
  if (shares.value > sellableShares.value + SHARE_EPSILON) return "Not enough shares to sell";
  return null;
});

const actionError = computed(() => (hasAccount() ? orderError.value : null));

function selectOutcome(outcome: Outcome) {
  selectedOutcome.value = outcome;
  emit("outcome-change", outcome);
}

function setOrderMode(mode: "market" | "limit") {
  orderMode.value = mode;
  if (mode !== "limit") return;
  if (limitPriceCents.value <= 0 && currentPrice.value > 0) limitPriceCents.value = clampLimitPriceCents(currentPrice.value, tickCents.value);
  if (limitShares.value <= 0 && shares.value > 0) limitShares.value = shares.value;
}

function clampSell(n: number) {
  return orderType.value === "sell" ? Math.min(n, sellableShares.value) : n;
}

function bumpAmount(d: number) {
  amount.value = clampSell(Math.max(0, (Number.isFinite(amount.value) ? amount.value : 0) + d));
}

function setMaxAmount() {
  if (orderType.value === "sell") {
    amount.value = sellableShares.value;
    return;
  }
  if (feeInfo.value.rate <= 0 || currentPrice.value <= 0) {
    amount.value = account.value.balance;
    return;
  }
  const fee = (max: number) => clobFeeUsd(feeInfo.value.rate, feeInfo.value.exponent, currentPrice.value / 100, calculateShares(max, currentPrice.value));
  let max = account.value.balance;
  for (let i = 0; i < 3; i += 1) max = Math.max(account.value.balance - fee(max), 0);
  max = Math.floor(max * 100) / 100;
  while (max > 0 && max + fee(max) > account.value.balance) max = Math.round((max - 0.01) * 100) / 100;
  amount.value = max;
}

function stepLimitPrice(dir: 1 | -1) {
  const base = limitPriceCents.value > 0 ? limitPriceCents.value : currentPrice.value;
  limitPriceCents.value = clampLimitPriceCents(base + dir * tickCents.value, tickCents.value);
}

function normalizeLimitPrice() {
  if (limitPriceCents.value > 0) limitPriceCents.value = clampLimitPriceCents(limitPriceCents.value, tickCents.value);
}

function bumpLimitShares(d: number) {
  limitShares.value = clampSell(Math.max(0, (Number.isFinite(limitShares.value) ? limitShares.value : 0) + d));
}

function setMaxLimitShares() {
  if (orderType.value === "sell") {
    limitShares.value = Math.floor(sellableShares.value * 100) / 100;
    return;
  }
  const price = limitPriceCents.value / 100;
  if (price <= 0) return;
  const taker = isMarketableLimit.value && !postOnly.value;
  const perShareFee = taker ? clobFeeUsd(feeInfo.value.rate, feeInfo.value.exponent, price, 100) / 100 : 0;
  let max = Math.floor((account.value.balance / (price + perShareFee)) * 100) / 100;
  if (limitOrderCost(limitPriceCents.value, max) + (taker ? clobFeeUsd(feeInfo.value.rate, feeInfo.value.exponent, price, max) : 0) > account.value.balance) max = Math.max(max - 0.01, 0);
  limitShares.value = max;
}

function applyBookLevel(level: BookLevelSelection) {
  placedNotice.value = null;
  orderMode.value = "limit";
  bookSelection.value = level;
  limitPriceCents.value = clampLimitPriceCents(level.priceCents, tickCents.value);
  orderType.value = level.side === "bid" && sellableShares.value > 0 ? "sell" : "buy";
  let prefill = level.shares;
  if (orderType.value === "sell") prefill = Math.min(prefill, sellableShares.value);
  else if (limitPriceCents.value > 0) prefill = Math.min(prefill, account.value.balance / (limitPriceCents.value / 100));
  limitShares.value = Math.max(Math.floor(prefill * 100) / 100, 0);
}

defineExpose({ applyBookLevel });

function openConfirmation() {
  if (!hasAccount()) {
    openSignin();
    return;
  }
  if (orderError.value) return;
  placedNotice.value = null;
  if (orderMode.value === "limit") {
    normalizeLimitPrice();
    previewSnapshot.value = { amount: orderCost.value, priceCents: limitPriceCents.value, shares: limitShares.value };
    confirmedMode.value = "limit";
    confirmedMarketable.value = isMarketableLimit.value;
    confirmedPostOnly.value = postOnly.value;
    confirmedFillPriceCents.value = marketableFillPriceCents.value;
  } else {
    previewSnapshot.value = orderType.value === "sell" ? createTradePreviewSnapshotFromShares(shares.value, currentPrice.value) : createTradePreviewSnapshot(amount.value, currentPrice.value);
    confirmedMode.value = "market";
    confirmedMarketable.value = true;
    confirmedPostOnly.value = false;
    confirmedFillPriceCents.value = previewSnapshot.value.priceCents;
  }
  confirmedPrice.value = previewSnapshot.value.priceCents;
  confirmedShares.value = previewSnapshot.value.shares;
  confirmedFee.value = feeUsd.value;
  previousFocusEl.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  showConfirmation.value = true;
  nextTick(() => executeButtonEl.value?.focus());
}

const confirmedTotal = computed(() => (orderType.value === "buy" ? previewSnapshot.value.amount + confirmedFee.value : previewSnapshot.value.amount));

function closeConfirmation() {
  showConfirmation.value = false;
  isExecuting.value = false;
  liveError.value = null;
  nextTick(() => {
    previousFocusEl.value?.focus();
    previousFocusEl.value = null;
  });
}

function onConfirmKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    closeConfirmation();
    return;
  }
  if (e.key !== "Tab") return;
  const back = backButtonEl.value;
  const exec = executeButtonEl.value;
  if (!back || !exec) return;
  const a = document.activeElement;
  if (e.shiftKey && a === back) {
    e.preventDefault();
    exec.focus();
  } else if (!e.shiftKey && a === exec) {
    e.preventDefault();
    back.focus();
  }
}

const { executeOrder } = useHatchetExecution({
  props,
  orderType,
  selectedOutcome,
  isLiveAccount,
  account,
  tickCents,
  confirmedMode,
  confirmedMarketable,
  confirmedPostOnly,
  confirmedFillPriceCents,
  feeInfo,
  previewSnapshot,
  isExecuting,
  liveError,
  placedNotice,
  showConfirmation,
  createOrUpdatePosition,
  sellPosition,
  addTransaction,
  saveAccount,
  placeOpenOrder,
  placeLiveOrder,
  placeLiveLimitOrder,
  syncLiveAccount,
  emit: (event, payload) => emit(event, payload),
  emitOrderPlaced: () => emit("order-placed"),
  closeConfirmation,
});
</script>

<style scoped>
.hatchet__tab--active::after {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: currentColor;
  content: "";
}

@keyframes hatchet-pop {
  0% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.07);
  }
  70% {
    transform: scale(0.97);
  }
  100% {
    transform: scale(1);
  }
}

.hatchet__amount-input--bounce .hatchet__currency,
.hatchet__amount-input--bounce input {
  animation: hatchet-pop 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.trade-confirm-enter-active,
.trade-confirm-leave-active {
  transition:
    opacity 280ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.trade-confirm-enter-from,
.trade-confirm-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

.trade-confirm-enter-to,
.trade-confirm-leave-from {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .hatchet__amount-input--bounce .hatchet__currency,
  .hatchet__amount-input--bounce input {
    animation: none;
  }
}
</style>
