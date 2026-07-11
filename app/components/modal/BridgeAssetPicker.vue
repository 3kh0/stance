<script setup lang="ts">
import type { SupportedAsset } from "~/composables/usePolymarketBridge";
import { tokenIconName, networkIconName } from "~/utils/cryptoIcons";

interface Selection {
  chainId: string | number;
  address: string;
}
interface Token {
  symbol: string;
  name?: string;
  address: string;
  minUsd?: number;
  icon: string;
}
interface Network {
  chainId: string | number;
  chainName: string;
  shortName: string;
  icon?: string;
  tokens: Token[];
}

const props = defineProps<{ assets: SupportedAsset[]; modelValue: Selection | null; disabled?: boolean }>();
const emit = defineEmits<{ "update:modelValue": [Selection] }>();

const NETWORK_ORDER = ["Polygon", "Ethereum", "Base", "Arbitrum", "Optimism", "Solana", "BNB Smart Chain"];
const TOKEN_RANK = ["USDC", "USDT", "DAI", "ETH", "WETH", "BTC", "WBTC"];
const shortName = (name: string) => (name === "BNB Smart Chain" ? "BNB" : name);

const networks = computed<Network[]>(() => {
  const byChain = new Map<string, Network>();
  for (const a of props.assets) {
    if (!a?.token?.address || a.chainId === undefined) continue;
    const key = String(a.chainId);
    let net = byChain.get(key);
    if (!net) {
      net = { chainId: a.chainId, chainName: a.chainName ?? key, shortName: shortName(a.chainName ?? key), icon: networkIconName(a.chainName ?? ""), tokens: [] };
      byChain.set(key, net);
    }
    const symbol = a.token.symbol ?? "?";
    if (net.tokens.some((t) => t.symbol.toLowerCase() === symbol.toLowerCase())) continue;
    net.tokens.push({ symbol, name: a.token.name, address: a.token.address, minUsd: a.minCheckoutUsd, icon: tokenIconName(symbol) });
  }
  const rank = (s: string) => {
    const i = TOKEN_RANK.indexOf(s.toUpperCase());
    return i === -1 ? TOKEN_RANK.length : i;
  };
  for (const net of byChain.values()) net.tokens.sort((x, y) => rank(x.symbol) - rank(y.symbol) || x.symbol.localeCompare(y.symbol));
  return [...byChain.values()].sort((x, y) => {
    const ix = NETWORK_ORDER.indexOf(x.chainName);
    const iy = NETWORK_ORDER.indexOf(y.chainName);
    return (ix === -1 ? NETWORK_ORDER.length : ix) - (iy === -1 ? NETWORK_ORDER.length : iy) || y.tokens.length - x.tokens.length;
  });
});

const selected = computed(() => {
  if (!props.modelValue) return undefined;
  for (const net of networks.value) {
    const token = net.tokens.find((t) => t.address.toLowerCase() === props.modelValue!.address.toLowerCase() && String(net.chainId) === String(props.modelValue!.chainId));
    if (token) return { net, token };
  }
  return undefined;
});

const open = ref(false);
const activeChainId = ref<string>("");

watch(open, (isOpen) => {
  if (isOpen) activeChainId.value = String(selected.value?.net.chainId ?? networks.value[0]?.chainId ?? "");
});

const activeNetwork = computed(() => networks.value.find((n) => String(n.chainId) === activeChainId.value) ?? networks.value[0]);

const pick = (net: Network, token: Token) => {
  emit("update:modelValue", { chainId: net.chainId, address: token.address });
  open.value = false;
};
</script>

<template>
  <div>
    <button type="button" :disabled="disabled" class="pm-focus flex w-full items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2.5 text-sm text-text transition hover:border-border-2 disabled:opacity-60" @click="open = !open">
      <template v-if="selected">
        <span class="flex items-center -space-x-1.5">
          <CoinIcon :icon="selected.net.icon" :label="selected.net.shortName" :size="20" />
          <CoinIcon :icon="selected.token.icon" :label="selected.token.symbol" :size="20" />
        </span>
        <span class="font-medium">{{ selected.net.chainName }} · {{ selected.token.symbol }}</span>
      </template>
      <span v-else class="text-text-3">Select a destination</span>
      <Icon name="lucide:chevron-down" class="ml-auto h-4 w-4 text-text-3 transition-transform" :class="open && 'rotate-180'" />
    </button>

    <div v-if="open" class="mt-2 overflow-hidden rounded-md border border-border bg-surface">
      <div class="flex gap-1.5 overflow-x-auto border-b border-border p-2">
        <button
          v-for="net in networks"
          :key="net.chainId"
          type="button"
          class="pm-focus flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors"
          :class="String(net.chainId) === activeChainId ? 'bg-surface-2 text-white' : 'text-text-3 hover:text-text-2'"
          @click="activeChainId = String(net.chainId)"
        >
          <CoinIcon :icon="net.icon" :label="net.shortName" :size="16" />
          {{ net.shortName }}
        </button>
      </div>
      <div class="max-h-56 overflow-y-auto p-1">
        <button v-for="token in activeNetwork?.tokens" :key="token.address" type="button" class="pm-focus flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surface-2" :class="selected?.token.address === token.address && 'bg-surface-2'" @click="pick(activeNetwork!, token)">
          <CoinIcon :icon="token.icon" :label="token.symbol" :size="22" />
          <span class="text-sm font-medium text-text">{{ token.symbol }}</span>
          <span v-if="token.name && token.name.toLowerCase() !== token.symbol.toLowerCase()" class="truncate text-[11px] text-text-3">{{ token.name }}</span>
          <Icon v-if="selected?.token.address === token.address" name="lucide:check" class="ml-auto h-4 w-4 text-white" />
        </button>
      </div>
    </div>
  </div>
</template>
