export default defineEventHandler(async (event) => {
  const s = getRouterParam(event, "slug");
  if (!s) throw createError({ statusCode: 400, statusMessage: "Slug parameter is required" });

  let resolved;
  try {
    resolved = await enrichEsportsTeamsForEvent(await fetchEventWithSportsSiblings(s));
  } catch (err) {
    const status = typeof (err as { statusCode?: unknown })?.statusCode === "number" ? (err as { statusCode: number }).statusCode : typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : null;
    if (status === 404 || status === 422) throw createError({ statusCode: 404, statusMessage: "Event not found" });
    throw err;
  }

  await attachCryptoPriceToBeat([resolved]);
  await attachFinancePriceToBeat([resolved]);
  return resolved;
});
