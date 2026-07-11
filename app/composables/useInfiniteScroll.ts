import { onBeforeUnmount, useTemplateRef, watch } from "vue";

export function useInfiniteScroll(onReachEnd: () => void, options: { refName?: string; threshold?: number; rootMargin?: string } = {}) {
  const sentinel = useTemplateRef<HTMLElement>(options.refName ?? "sentinel");
  let observer: IntersectionObserver | null = null;

  watch(
    sentinel,
    (el) => {
      observer?.disconnect();
      if (!el) return;
      observer ??= new IntersectionObserver((entries) => entries[0]?.isIntersecting && onReachEnd(), { threshold: options.threshold, rootMargin: options.rootMargin });
      observer.observe(el);
    },
    { immediate: true },
  );

  onBeforeUnmount(() => observer?.disconnect());

  return { sentinel };
}
