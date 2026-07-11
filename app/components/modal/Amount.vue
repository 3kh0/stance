<script setup lang="ts">
import { validateTransferAmount } from "~/utils/markets";
import { fmtm, fmtn } from "~/utils/prices";

const props = defineProps<{
  isOpen: boolean;
  type: "deposit" | "withdraw";
}>();

const emit = defineEmits<{ close: [] }>();

const { account, addTransaction, saveAccount } = useAccount();
const MAX = 100_000;

const amount = ref("");
const loading = ref(false);
const error = ref("");

const label = computed(() => (props.type === "deposit" ? "Deposit" : "Withdraw"));
const availableBalance = computed(() => Math.max(account.value.balance, 0));
const effectiveMax = computed(() => (props.type === "withdraw" ? Math.min(MAX, availableBalance.value) : MAX));
const helperText = computed(() => (props.type === "withdraw" ? `Available: $${fmtm(availableBalance.value)}` : `Maximum: $${fmtn(MAX)}`));

const handleSubmit = async () => {
  error.value = "";
  if (!String(amount.value).trim()) {
    error.value = "Please enter an amount";
    return;
  }
  const value = parseFloat(amount.value);
  const validation = validateTransferAmount(props.type, value, account.value.balance, MAX);
  if (validation) {
    error.value = validation;
    return;
  }
  loading.value = true;
  await new Promise((r) => setTimeout(r, 300));
  addTransaction({ type: props.type, amount: value });
  saveAccount({ balance: account.value.balance + (props.type === "deposit" ? value : -value) });
  loading.value = false;
  amount.value = "";
  emit("close");
};

const handleClose = () => {
  if (loading.value) return;
  amount.value = "";
  error.value = "";
  emit("close");
};

const setMax = () => {
  amount.value = effectiveMax.value ? String(effectiveMax.value) : "";
  error.value = "";
};
</script>

<template>
  <ModalShell :is-open="isOpen" :close-on-backdrop="!loading" aria-labelledby="amount-modal-title" @close="handleClose">
    <h2 id="amount-modal-title" class="mb-4 text-center text-(--text-primary) text-xl font-[650] leading-7">{{ label }}</h2>
    <div class="mb-6">
      <label class="mb-2 block text-(--text-secondary) text-sm font-[590] leading-5">Amount</label>
      <div class="relative">
        <span class="absolute left-4 top-3 text-(--text-meta) text-lg leading-6">$</span>
        <input
          v-model="amount"
          type="number"
          placeholder="0.00"
          :disabled="loading"
          class="pm-focus w-full rounded-[7.2px] border border-border bg-(--color-secondary) py-3 pl-8 pr-4 text-(--text-primary) text-[15px] leading-5.5 transition placeholder:text-(--text-muted) disabled:cursor-not-allowed disabled:opacity-50"
          @keyup.enter="handleSubmit"
        />
      </div>
      <div class="mt-2 flex items-center justify-between gap-3 text-(--text-muted) text-xs leading-4">
        <p>{{ helperText }}</p>
        <button v-if="type === 'withdraw'" type="button" class="pm-focus text-(--color-primary) font-[650] hover:text-(--color-primary-hover)" :disabled="loading || effectiveMax <= 0" @click="setMax">Max</button>
      </div>
    </div>
    <div v-if="error" class="mb-4 rounded-[7.2px] border border-(--market-no)/50 bg-(--market-no-bg) p-3">
      <p class="text-(--market-no) text-sm leading-5">{{ error }}</p>
    </div>
    <button :disabled="loading" class="pm-button pm-button--primary pm-focus mb-3 w-full min-h-12 disabled:cursor-not-allowed disabled:opacity-50" @click="handleSubmit">
      {{ loading ? "Processing..." : label }}
    </button>
    <button :disabled="loading" class="pm-button pm-button--secondary pm-focus mb-3 w-full min-h-12 disabled:cursor-not-allowed disabled:opacity-50" @click="handleClose">Cancel</button>
  </ModalShell>
</template>
