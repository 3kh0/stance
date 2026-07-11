import type { GammaEvent } from "~/types/gamma";
import { buildEventDescription, buildEventTitle } from "~/utils/eventSeo";
import { isSportsEvent, sportsEventUrl } from "~/utils/sports";

export function useEventSeo(event: Ref<GammaEvent | null | undefined>, slug: Ref<string>) {
  const origin = useSiteOrigin();

  const pageUrl = computed(() => {
    const path = event.value && isSportsEvent(event.value) ? sportsEventUrl(event.value) : `/event/${slug.value}`;
    return origin.value ? `${origin.value}${path}` : path;
  });
  const ogImage = computed(() => (origin.value ? `${origin.value}/og/event/${slug.value}` : `/og/event/${slug.value}`));
  const title = computed(() => (event.value ? buildEventTitle(event.value) : "Stance"));
  const description = computed(() => (event.value ? buildEventDescription(event.value) : "Paper trade prediction markets on Stance."));

  useSeoMeta({
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogImage,
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: title,
    ogUrl: pageUrl,
    ogType: "website",
    ogSiteName: "Stance",
    twitterCard: "summary_large_image",
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: ogImage,
  });
}
