import type NProgressType from "nprogress";

let p: Promise<typeof NProgressType> | null = null;

async function withProgress(action: (progress: typeof NProgressType) => void) {
  if (!import.meta.client) return;
  p ??= import("nprogress").then((m) => m.default);
  action(await p);
}

export const useLoader = () => ({
  start: () => withProgress((p) => p.start()),
  done: () => withProgress((p) => p.done()),
});
