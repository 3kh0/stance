import type { LiveOpenOrder } from "~/composables/usePolymarket";

const POLL_MS = 12_000;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let onWake: (() => void) | null = null;
let consumers = 0;
let inFlight = false;

export function useLiveOpenOrders() {
  const orders = useState<LiveOpenOrder[]>("live-open-orders", () => []);
  const { isLiveAccount } = useAccount();
  const { fetchLiveOpenOrders } = usePolymarket();

  const refresh = async () => {
    if (!isLiveAccount.value) {
      orders.value = [];
      return;
    }
    if (inFlight) return;
    inFlight = true;
    try {
      orders.value = await fetchLiveOpenOrders();
    } catch {
      void 0;
    } finally {
      inFlight = false;
    }
  };

  const start = () => {
    if (typeof window === "undefined") return;
    consumers += 1;
    void refresh();
    if (pollTimer) return;
    pollTimer = setInterval(() => void refresh(), POLL_MS);
    onWake = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
  };

  const stop = () => {
    consumers = Math.max(0, consumers - 1);
    if (consumers > 0 || !pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
    if (onWake) {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      onWake = null;
    }
  };

  return { orders, refresh, start, stop };
}
