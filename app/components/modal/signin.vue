<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    mode?: "choose" | "paper" | "wallet";
  }>(),
  { mode: "choose" },
);

const emit = defineEmits<{ close: [] }>();

const { initializeAccount } = useAccount();
const { hasProvider } = useWallet();
const { linkWallet, linkStatusLabel } = usePolymarket();

const step = ref<"welcome" | "username" | "wallet" | "complete">("welcome");
const username = ref("");
const loading = ref(false);
const direction = ref<"forward" | "back">("forward");
const walletError = ref<string | null>(null);
const linkedLive = ref(false);

const reset = () => {
  step.value = props.mode === "paper" ? "username" : props.mode === "wallet" ? "wallet" : "welcome";
  username.value = "";
  loading.value = false;
  direction.value = "forward";
  walletError.value = null;
  linkedLive.value = false;
};

const handleContinue = async () => {
  direction.value = "forward";
  if (step.value !== "username" || !username.value.trim()) return;
  loading.value = true;
  await new Promise((r) => setTimeout(r, 300));
  initializeAccount(username.value.trim());
  step.value = "complete";
  loading.value = false;
};

const choosePaper = () => {
  direction.value = "forward";
  step.value = "username";
};
const chooseWallet = () => {
  direction.value = "forward";
  walletError.value = null;
  step.value = "wallet";
};
const handleBack = () => {
  direction.value = "back";
  if (step.value === "username" || step.value === "wallet") step.value = "welcome";
};

const connectWallet = async () => {
  if (loading.value) return;
  loading.value = true;
  walletError.value = null;
  try {
    const account = await linkWallet();
    username.value = account.username;
    linkedLive.value = true;
    step.value = "complete";
  } catch (e) {
    walletError.value = e instanceof Error ? e.message : "Could not link your wallet. Please try again.";
  } finally {
    loading.value = false;
  }
};

watch(
  () => props.isOpen,
  (open) => {
    if (open) reset();
  },
);
</script>

<template>
  <ModalShell :is-open="isOpen" aria-labelledby="signin-modal-title" @close="emit('close')">
    <div class="relative flex flex-col justify-center min-h-75">
      <Transition name="slide" mode="out-in">
        <div v-if="step === 'welcome'" key="welcome" class="w-full text-center">
          <h2 id="signin-modal-title" class="mb-4 text-(--text-primary) text-xl font-[650] leading-7">Welcome to Stance</h2>
          <p class="mb-6 text-(--text-meta) text-sm leading-5">Practice risk-free with paper trading, or link your wallet to trade with your real Polymarket account.</p>
          <button class="pm-button pm-button--primary pm-focus mb-3 w-full min-h-12" @click="choosePaper">Start paper trading</button>
          <button class="pm-button pm-button--secondary pm-focus mb-3 w-full min-h-12" @click="chooseWallet">
            <Icon name="lucide:link" class="h-4.5 w-4.5" />
            Link Polymarket wallet
          </button>
          <p class="mt-6 text-(--text-muted) text-xs leading-4">Your progress is saved locally on device. Not affiliated with Polymarket. All investing involves risk. Paper trading allows you to experiment without monetary loss.</p>
        </div>
      </Transition>
      <Transition :name="direction === 'back' ? 'slide-back' : 'slide'" mode="out-in">
        <div v-if="step === 'username'" key="username" class="w-full text-center">
          <h2 id="signin-modal-title" class="mb-4 text-(--text-primary) text-xl font-[650] leading-7">What's your username?</h2>
          <input v-model="username" type="text" placeholder="Enter a username" class="pm-focus mb-6 w-full rounded-[7.2px] border border-border bg-(--color-secondary) px-4 py-3 text-(--text-primary) text-[15px] leading-5.5 transition placeholder:text-(--text-muted)" @keyup.enter="handleContinue" />
          <button :disabled="!username.trim() || loading" class="pm-button pm-button--primary pm-focus mb-3 w-full min-h-12 disabled:cursor-not-allowed disabled:opacity-50" @click="handleContinue">
            <span v-if="loading" class="flex items-center justify-center gap-2">
              <Icon name="lucide:circle-dashed" class="h-4 w-4 animate-spin" />
              Creating...
            </span>
            <span v-else>Create Account</span>
          </button>
          <button :disabled="loading" class="pm-button pm-button--secondary pm-focus mb-3 w-full min-h-12 disabled:cursor-not-allowed disabled:opacity-50" @click="handleBack">Back</button>
        </div>
      </Transition>
      <Transition :name="direction === 'back' ? 'slide-back' : 'slide'" mode="out-in">
        <div v-if="step === 'wallet'" key="wallet" class="w-full text-center">
          <h2 id="signin-modal-title" class="mb-4 text-(--text-primary) text-xl font-[650] leading-7">Link your Polymarket wallet</h2>
          <p class="mb-6 text-(--text-meta) text-sm leading-5">Connect the wallet you use on polymarket.com to place real orders. You'll sign one message to enable trading. This never moves funds and costs no gas.</p>
          <div v-if="!hasProvider()" class="mb-6 rounded-[7.2px] border border-[rgba(234,179,8,0.25)] bg-[rgba(234,179,8,0.1)] px-3 py-2 text-[#eab308] text-[13px] font-[590] leading-4.5">No crypto wallet detected. Install MetaMask, then reload this page.</div>
          <div v-if="walletError" class="mb-4 rounded-[7.2px] border border-[rgba(226,57,57,0.25)] bg-(--market-no-bg) px-3 py-2 text-(--market-no) text-[13px] font-[590] leading-4.5" role="alert">{{ walletError }}</div>
          <button :disabled="loading || !hasProvider()" class="pm-button pm-button--primary pm-focus mb-3 w-full min-h-12 disabled:cursor-not-allowed disabled:opacity-50" @click="connectWallet">
            <span v-if="loading" class="flex items-center justify-center gap-2">
              <Icon name="lucide:circle-dashed" class="h-4 w-4 animate-spin" />
              {{ linkStatusLabel }}
            </span>
            <span v-else>Connect wallet</span>
          </button>
          <button :disabled="loading" class="pm-button pm-button--secondary pm-focus mb-3 w-full min-h-12 disabled:cursor-not-allowed disabled:opacity-50" @click="handleBack">Back</button>
        </div>
      </Transition>
      <Transition name="slide" mode="out-in">
        <div v-if="step === 'complete'" key="complete" class="w-full text-center">
          <div class="mb-4 text-(--market-yes) text-4xl">
            <Icon name="lucide:circle-check" />
          </div>
          <h2 id="signin-modal-title" class="mb-4 text-(--text-primary) text-xl font-[650] leading-7">Welcome, {{ username }}!</h2>
          <p v-if="linkedLive" class="mb-6 text-(--text-meta) text-sm leading-5">You are now able to place real orders on Polymarket using your linked account.</p>
          <p v-else class="mb-6 text-(--text-meta) text-sm leading-5">You're all set to start trading on Stance. May the odds be ever in your favor.</p>
          <button class="pm-button pm-button--primary pm-focus mb-3 w-full min-h-12" @click="emit('close')">Start trading</button>
        </div>
      </Transition>
    </div>
  </ModalShell>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active,
.slide-back-enter-active,
.slide-back-leave-active {
  position: absolute;
  width: 100%;
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.slide-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-back-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-back-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
