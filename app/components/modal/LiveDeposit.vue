<script setup lang="ts">
import { usePolymarketBridge, type BridgeAddresses } from "~/composables/usePolymarketBridge";
import { useAccount } from "~/composables/useAccount";

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { account } = useAccount();
const { getDepositAddresses, sendDeposit, pollStatus } = usePolymarketBridge();

const loadingAddresses = ref(false);
const addresses = ref<BridgeAddresses>({});
const addressError = ref("");

const amount = ref("");
const token = ref<"USDC" | "USDC.e">("USDC");
const sending = ref(false);
const error = ref("");
const txHash = ref("");
const settling = ref(false);
const copied = ref<string | null>(null);

const funder = computed(() => account.value.wallet?.funder ?? "");

const loadAddresses = async () => {
  loadingAddresses.value = true;
  addressError.value = "";
  try {
    addresses.value = await getDepositAddresses();
  } catch (e) {
    addressError.value = (e as Error)?.message || "Couldn't generate a deposit address.";
  } finally {
    loadingAddresses.value = false;
  }
};

watch(
  () => props.isOpen,
  (open) => {
    if (!open) return;
    txHash.value = "";
    error.value = "";
    amount.value = "";
    loadAddresses();
  },
  { immediate: true },
);

const copy = async (value?: string) => {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    copied.value = value;
    setTimeout(() => (copied.value = value === copied.value ? null : copied.value), 1500);
  } catch {}
};

const handleSend = async () => {
  error.value = "";
  const evm = addresses.value.evm;
  if (!evm) {
    error.value = "No deposit address available.";
    return;
  }
  if (!String(amount.value).trim() || Number(amount.value) <= 0) {
    error.value = "Enter an amount greater than zero.";
    return;
  }
  sending.value = true;
  try {
    const sinceMs = Date.now();
    txHash.value = await sendDeposit(amount.value, { evm, token: token.value });
    settling.value = true;
    pollStatus(evm, { sinceMs }).finally(() => (settling.value = false));
  } catch (e) {
    error.value = (e as Error)?.message || "The deposit transaction failed.";
  } finally {
    sending.value = false;
  }
};

const handleClose = () => {
  if (!sending.value) emit("close");
};
</script>

<template>
  <ModalShell :is-open="isOpen" :close-on-backdrop="!sending" aria-labelledby="live-deposit-title" @close="handleClose">
    <h2 id="live-deposit-title" class="mb-1 text-center text-lg font-semibold text-white">Deposit</h2>
    <p class="mb-5 text-center text-xs leading-5 text-text-3">Funds are bridged and swapped to pUSD, then credited to your account.</p>
    <div v-if="loadingAddresses" class="py-8 text-center text-sm text-text-3">Generating deposit address…</div>
    <div v-else-if="addressError" class="rounded-md border border-no/50 bg-no-bg p-3 text-sm text-no">{{ addressError }}</div>
    <template v-else>
      <div class="mb-4">
        <div class="mb-1.5 flex items-center justify-between">
          <label class="text-[10px] font-bold uppercase tracking-widest text-text-3">Deposit address (Polygon / EVM)</label>
          <button type="button" class="pm-focus flex items-center gap-1 text-[11px] font-semibold text-text-2 transition-colors hover:text-white" @click="copy(addresses.evm)">
            <Icon :name="copied === addresses.evm ? 'lucide:check' : 'lucide:copy'" class="h-3 w-3" />
            {{ copied === addresses.evm ? "Copied" : "Copy" }}
          </button>
        </div>
        <div class="font-mono break-all rounded-md border border-border bg-surface-2 px-3 py-2.5 text-[12px] leading-4 text-text">{{ addresses.evm || "—" }}</div>
        <p class="mt-1.5 text-[11px] leading-4 text-text-3">Send USDC on Polygon (or USDC on any supported chain) to this address.</p>
      </div>
      <div v-if="addresses.svm || addresses.btc" class="mb-5 space-y-2">
        <div v-if="addresses.svm" class="flex items-center gap-2">
          <span class="w-10 shrink-0 text-[10px] font-bold uppercase tracking-widest text-text-3">SOL</span>
          <span class="font-mono flex-1 truncate text-[11px] text-text-2">{{ addresses.svm }}</span>
          <button type="button" class="pm-focus text-text-3 transition-colors hover:text-white" @click="copy(addresses.svm)"><Icon :name="copied === addresses.svm ? 'lucide:check' : 'lucide:copy'" class="h-3.5 w-3.5" /></button>
        </div>
        <div v-if="addresses.btc" class="flex items-center gap-2">
          <span class="w-10 shrink-0 text-[10px] font-bold uppercase tracking-widest text-text-3">BTC</span>
          <span class="font-mono flex-1 truncate text-[11px] text-text-2">{{ addresses.btc }}</span>
          <button type="button" class="pm-focus text-text-3 transition-colors hover:text-white" @click="copy(addresses.btc)"><Icon :name="copied === addresses.btc ? 'lucide:check' : 'lucide:copy'" class="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div class="rounded-lg border border-border bg-surface px-3.5 py-3.5">
        <div class="mb-2.5 flex items-center justify-between">
          <span class="text-[11px] font-semibold text-text-2">Send from connected wallet</span>
          <div class="flex overflow-hidden rounded-md border border-border">
            <button v-for="opt in ['USDC', 'USDC.e'] as const" :key="opt" type="button" class="pm-focus px-2 py-0.5 text-[10px] font-bold transition-colors" :class="token === opt ? 'bg-surface-2 text-white' : 'text-text-3 hover:text-text-2'" @click="token = opt">{{ opt }}</button>
          </div>
        </div>
        <div class="flex gap-2">
          <div class="relative flex-1">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-3">$</span>
            <input v-model="amount" type="number" placeholder="0.00" :disabled="sending" class="pm-focus w-full rounded-md border border-border bg-surface-2 py-2 pl-7 pr-3 text-sm text-text transition placeholder:text-text-3 disabled:opacity-50" @keyup.enter="handleSend" />
          </div>
          <button :disabled="sending" class="pm-button pm-button--primary pm-focus min-w-24 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50" @click="handleSend">{{ sending ? "Sending…" : "Send" }}</button>
        </div>
        <p v-if="txHash" class="mt-2 text-[11px] leading-4 text-yes">Transaction sent.{{ settling ? " Waiting for the bridge to credit your account…" : " It may take a minute to appear." }}</p>
      </div>
      <div v-if="error" class="mt-3 rounded-md border border-no/50 bg-no-bg p-2.5 text-[12px] text-no">{{ error }}</div>
    </template>

    <button class="pm-button pm-button--secondary pm-focus mt-4 w-full min-h-11" :disabled="sending" @click="handleClose">{{ txHash ? "Done" : "Close" }}</button>
    <p v-if="funder" class="mt-3 text-center text-[10px] text-text-3" :title="funder">Crediting {{ funder.slice(0, 6) }}…{{ funder.slice(-4) }}</p>
  </ModalShell>
</template>
