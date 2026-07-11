<script setup lang="ts">
import type { Position } from "~/composables/useAccount";
import { positionCurrentValue } from "~/utils/markets";
import { fmtm } from "~/utils/prices";

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    position: Position | null;

    pending?: boolean;
    error?: string | null;

    live?: boolean;
  }>(),
  { pending: false, error: null, live: false },
);

const emit = defineEmits<{
  close: [];
  confirm: [shares: number];
}>();

const percent = ref(100);
watch(
  () => [props.isOpen, props.position?.positionKey],
  () => (percent.value = 100),
);

const outcomeLabel = computed(() => (props.position?.outcome === "yes" ? "Yes" : "No"));
const marketTitle = computed(() => props.position?.question || props.position?.marketName.replace(/\s+-\s+(Yes|No)$/i, "") || "Position");
const priceCents = computed(() => (props.position ? props.position.currentPrice * 100 : 0));
const sharesToSell = computed(() => {
  if (!props.position) return 0;
  return percent.value >= 100 ? props.position.shares : Math.floor(props.position.shares * (percent.value / 100) * 100) / 100;
});
const receiveAmount = computed(() => (props.position ? positionCurrentValue({ ...props.position, shares: sharesToSell.value }) : 0));
const canConfirm = computed(() => !!props.position && sharesToSell.value > 0 && receiveAmount.value > 0 && !props.pending);
const confirmExit = () => {
  if (canConfirm.value) emit("confirm", sharesToSell.value);
};
</script>

<template>
  <ModalShell :is-open="isOpen" aria-labelledby="portfolio-exit-title" panel-class="portfolio-exit-modal" @close="emit('close')">
    <div v-if="position" class="portfolio-exit">
      <button class="portfolio-exit__close pm-focus" type="button" aria-label="Close" @click="emit('close')">
        <Icon name="lucide:x" />
      </button>
      <p class="portfolio-exit__eyebrow">Sell {{ outcomeLabel }}</p>
      <h2 id="portfolio-exit-title">{{ marketTitle }}</h2>
      <div class="portfolio-exit__receive">
        <span>Receive</span>
        <strong><NumericOdometer :value="receiveAmount" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" /></strong>
      </div>
      <p class="portfolio-exit__meta">Selling <NumericOdometer :value="sharesToSell" :maximum-fraction-digits="2" /> of <NumericOdometer :value="position.shares" :maximum-fraction-digits="2" /> shares @ <NumericOdometer :value="priceCents" :maximum-fraction-digits="1" />c</p>
      <div class="portfolio-exit__slider">
        <input v-model.number="percent" class="pm-focus" type="range" min="0" max="100" step="25" aria-label="Percent of position to sell" />
        <div class="portfolio-exit__ticks" aria-hidden="true">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>
      <div v-if="error" class="portfolio-exit__error" role="alert">{{ error }}</div>
      <div class="portfolio-exit__actions">
        <button class="pm-button pm-button--secondary pm-focus" type="button" :disabled="pending" @click="emit('close')">Edit order</button>
        <button class="pm-button pm-button--primary pm-focus" type="button" :disabled="!canConfirm" @click="confirmExit">
          {{ pending ? "Confirm in your wallet..." : `Cash out $${fmtm(receiveAmount)}` }}
        </button>
      </div>
      <p v-if="live" class="portfolio-exit__live-note">This places a real sell order on Polymarket. Your wallet will ask you to sign it.</p>
    </div>
  </ModalShell>
</template>

<style scoped>
:deep(.portfolio-exit-modal) {
  max-width: 560px;
  padding: 28px;
}

.portfolio-exit {
  position: relative;
}

.portfolio-exit__close {
  position: absolute;
  top: -8px;
  right: -8px;
  display: inline-flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--text-meta);
  transition:
    color 150ms ease,
    background-color 150ms ease;
}

.portfolio-exit__close:hover {
  background: var(--color-secondary);
  color: var(--text-primary);
}

.portfolio-exit__close :deep(svg) {
  width: 26px;
  height: 26px;
}

.portfolio-exit__eyebrow {
  margin-bottom: 8px;
  color: var(--text-primary);
  font-size: 28px;
  font-weight: 800;
  line-height: 34px;
}

.portfolio-exit h2 {
  margin: 0 48px 32px 0;
  color: var(--text-meta);
  font-size: 18px;
  font-weight: 650;
  line-height: 26px;
}

.portfolio-exit__receive {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 8px;
}

.portfolio-exit__receive span {
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 650;
  line-height: 30px;
}

.portfolio-exit__receive strong {
  color: var(--market-yes);
  font-size: 34px;
  font-weight: 800;
  line-height: 42px;
}

.portfolio-exit__meta {
  color: var(--text-meta);
  font-size: 17px;
  font-weight: 590;
  line-height: 26px;
}

.portfolio-exit__slider {
  margin: 56px 0 44px;
}

.portfolio-exit__slider input {
  width: 100%;
  accent-color: var(--color-primary);
}

.portfolio-exit__ticks {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 650;
  line-height: 20px;
}

.portfolio-exit__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.portfolio-exit__actions .pm-button {
  min-height: 56px;
}

.portfolio-exit__actions .pm-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.portfolio-exit__error {
  margin-bottom: 12px;
  border: 1px solid rgba(226, 57, 57, 0.25);
  border-radius: 7.2px;
  background: var(--market-no-bg);
  color: var(--market-no);
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 590;
  line-height: 18px;
  text-align: center;
}

.portfolio-exit__live-note {
  margin-top: 14px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 16px;
  text-align: center;
}

@media (max-width: 560px) {
  :deep(.portfolio-exit-modal) {
    padding: 24px;
  }

  .portfolio-exit__actions {
    grid-template-columns: 1fr;
  }

  .portfolio-exit__eyebrow {
    font-size: 24px;
    line-height: 30px;
  }
}
</style>
