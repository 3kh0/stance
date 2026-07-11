<script setup lang="ts">
import { usePolymarketBridge, type SupportedAsset, type WithdrawQuote } from "~/composables/usePolymarketBridge";
import { useAccount } from "~/composables/useAccount";
import { POLYGON_TOKENS } from "~/utils/erc20";
import { POLYGON_CHAIN_ID } from "~/composables/useWallet";
import { fmtm } from "~/utils/prices";

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { account } = useAccount();
const { getSupportedAssets, getWithdrawQuote, executeWithdraw, pollStatus } = usePolymarketBridge();

const DEFAULT_SELECTION: { chainId: string | number; address: string } = { chainId: POLYGON_CHAIN_ID, address: POLYGON_TOKENS.USDC };

const step = ref<"form" | "review" | "submitting" | "done">("form");
const amount = ref("");
const recipient = ref("");
const assets = ref<SupportedAsset[]>([]);
const selection = ref({ ...DEFAULT_SELECTION });
const quote = ref<WithdrawQuote | null>(null);
const error = ref("");
const busy = ref(false);

const available = computed(() => Math.max(account.value.balance, 0));
const isSafe = computed(() => (account.value.wallet?.signatureType ?? 0) !== 0);
const dest = computed(() => {
  const match = assets.value.find((a) => String(a.chainId) === String(selection.value.chainId) && a.token?.address?.toLowerCase() === selection.value.address.toLowerCase());
  return match ? { label: `${match.chainName} · ${match.token.symbol}`, chainId: match.chainId, address: match.token.address, minUsd: match.minCheckoutUsd } : { label: "Polygon · USDC", chainId: selection.value.chainId, address: selection.value.address, minUsd: undefined as number | undefined };
});

const loadAssets = async () => {
  try {
    assets.value = await getSupportedAssets();
    const usdc = assets.value.find((a) => a.chainName === "Polygon" && a.token?.symbol === "USDC");
    if (usdc) selection.value = { chainId: usdc.chainId, address: usdc.token.address };
  } catch {}
};

watch(
  () => props.isOpen,
  (open) => {
    if (!open) return;
    step.value = "form";
    error.value = "";
    amount.value = "";
    quote.value = null;
    selection.value = { ...DEFAULT_SELECTION };
    recipient.value = account.value.wallet?.address ?? "";
    loadAssets();
  },
  { immediate: true },
);

const setMax = () => (amount.value = available.value > 0 ? String(available.value) : "");

const validate = (): string => {
  const value = Number(amount.value);
  if (!String(amount.value).trim() || !Number.isFinite(value) || value <= 0) return "Enter an amount greater than zero.";
  if (value > available.value) return "Amount exceeds your available balance.";
  if (dest.value.minUsd && value < dest.value.minUsd) return `Minimum withdrawal to ${dest.value.label} is $${dest.value.minUsd}.`;
  if (!/^0x[a-fA-F0-9]{40}$/.test(recipient.value.trim())) return "Enter a valid recipient address.";
  return "";
};

const handleReview = async () => {
  error.value = validate();
  if (error.value) return;
  busy.value = true;
  try {
    quote.value = await getWithdrawQuote({ toChainId: dest.value.chainId, toTokenAddress: dest.value.address, recipientAddr: recipient.value.trim(), amount: amount.value }).catch(() => null);
    step.value = "review";
  } finally {
    busy.value = false;
  }
};

const handleConfirm = async () => {
  error.value = "";
  busy.value = true;
  step.value = "submitting";
  try {
    const sinceMs = Date.now();
    const bridgeEvm = await executeWithdraw({ amount: amount.value, toChainId: dest.value.chainId, toTokenAddress: dest.value.address, recipientAddr: recipient.value.trim() });
    step.value = "done";
    pollStatus(bridgeEvm, { sinceMs }).catch(() => {});
  } catch (e) {
    error.value = (e as Error)?.message || "The withdrawal failed.";
    step.value = "review";
  } finally {
    busy.value = false;
  }
};

const handleClose = () => {
  if (!busy.value) emit("close");
};
</script>

<template>
  <ModalShell :is-open="isOpen" :close-on-backdrop="!busy" aria-labelledby="live-withdraw-title" @close="handleClose">
    <h2 id="live-withdraw-title" class="mb-1 text-center text-lg font-semibold text-white">Withdraw</h2>
    <p class="mb-5 text-center text-xs leading-5 text-text-3">pUSD is bridged from your Polymarket wallet to the destination you choose.</p>
    <template v-if="step === 'done'">
      <div class="rounded-lg border border-yes/40 bg-yes-bg px-4 py-5 text-center">
        <Icon name="lucide:check-circle-2" class="mx-auto mb-2 h-7 w-7 text-yes" />
        <p class="text-sm font-semibold text-white">Withdrawal submitted</p>
        <p class="mt-1 text-[12px] leading-5 text-text-2">{{ fmtm(Number(amount)) }} is on its way to {{ recipient.slice(0, 6) }}…{{ recipient.slice(-4) }}. Bridge transfers can take a few minutes.</p>
      </div>
      <button class="pm-button pm-button--secondary pm-focus mt-4 w-full min-h-11" @click="handleClose">Done</button>
    </template>

    <template v-else>
      <div class="mb-4">
        <div class="mb-1.5 flex items-center justify-between">
          <label class="text-[10px] font-bold uppercase tracking-widest text-text-3">Amount</label>
          <button type="button" class="pm-focus text-[11px] font-semibold text-text-2 hover:text-white" :disabled="step !== 'form' || available <= 0" @click="setMax">Max · ${{ fmtm(available) }}</button>
        </div>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-3">$</span>
          <input v-model="amount" type="number" placeholder="0.00" :disabled="step !== 'form'" class="font-mono pm-focus w-full rounded-md border border-border bg-surface-2 py-2.5 pl-7 pr-3 text-text transition placeholder:text-text-3 disabled:opacity-60" />
        </div>
      </div>
      <div class="mb-4">
        <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-text-3">Destination</label>
        <ModalBridgeAssetPicker v-model="selection" :assets="assets" :disabled="step !== 'form'" />
      </div>
      <div class="mb-4">
        <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-text-3">Recipient address</label>
        <input v-model="recipient" type="text" spellcheck="false" placeholder="0x…" :disabled="step !== 'form'" class="font-mono pm-focus w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-[12px] text-text transition placeholder:text-text-3 disabled:opacity-60" />
      </div>
      <div v-if="step === 'review' && quote" class="mb-4 space-y-1.5 rounded-md border border-border bg-surface px-3.5 py-3 text-[12px]">
        <div v-if="quote.estimatedOutput !== undefined" class="flex justify-between">
          <span class="text-text-3">You receive</span><span class="font-mono text-text">≈ ${{ fmtm(quote.estimatedOutput) }}</span>
        </div>
        <div v-if="quote.appFee" class="flex justify-between">
          <span class="text-text-3">{{ quote.appFeeLabel || "Fee" }}</span
          ><span class="font-mono text-text">${{ fmtm(quote.appFee) }}</span>
        </div>
        <div v-if="quote.impactPercent !== undefined" class="flex justify-between">
          <span class="text-text-3">Price impact</span><span class="font-mono text-text">{{ quote.impactPercent < 0.01 ? "<0.01" : quote.impactPercent.toFixed(2) }}%</span>
        </div>
        <div v-if="quote.etaMs !== undefined" class="flex justify-between">
          <span class="text-text-3">Est. time</span><span class="font-mono text-text">~{{ Math.max(1, Math.round(quote.etaMs / 1000)) }}s</span>
        </div>
        <div v-if="quote.estimatedOutput === undefined" class="text-text-3">Confirm to bridge {{ fmtm(Number(amount)) }} pUSD to {{ dest.label }}.</div>
      </div>
      <p v-if="step === 'review' && isSafe" class="mb-3 rounded-md border border-border bg-surface px-3 py-2 text-[11px] leading-4 text-text-3">Your funds are held in a Safe — approve the signature in your wallet and the transfer is submitted gaslessly via Polymarket's relayer.</p>
      <div v-if="error" class="mb-3 rounded-md border border-no/50 bg-no-bg p-2.5 text-[12px] text-no">{{ error }}</div>
      <button v-if="step === 'form'" :disabled="busy" class="pm-button pm-button--primary pm-focus w-full min-h-11 disabled:cursor-not-allowed disabled:opacity-50" @click="handleReview">{{ busy ? "Checking…" : "Review withdrawal" }}</button>
      <template v-else>
        <button :disabled="busy" class="pm-button pm-button--primary pm-focus w-full min-h-11 disabled:cursor-not-allowed disabled:opacity-50" @click="handleConfirm">{{ step === "submitting" ? "Submitting…" : "Confirm withdrawal" }}</button>
        <button :disabled="busy" class="pm-button pm-button--secondary pm-focus mt-2 w-full min-h-11 disabled:opacity-50" @click="step = 'form'">Back</button>
      </template>

      <button v-if="step === 'form'" class="pm-button pm-button--secondary pm-focus mt-2 w-full min-h-11" :disabled="busy" @click="handleClose">Cancel</button>
    </template>
  </ModalShell>
</template>
