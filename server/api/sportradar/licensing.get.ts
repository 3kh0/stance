import { patchSportradarLicenseForOrigin, SPORTRADAR_WIDGET_KEY } from "../../utils/sportradarLicense";

export default defineEventHandler(async (event) => {
  setHeader(event, "cache-control", "no-store");
  const response = await fetch(`https://widgets.sir.sportradar.com/${SPORTRADAR_WIDGET_KEY}/licensing`, {
    headers: { Referer: "https://polymarket.com/", Origin: "https://polymarket.com" },
  });
  if (!response.ok) throw createError({ statusCode: response.status, statusMessage: "Sportradar licensing check failed" });

  const license = (await response.json()) as { valid?: boolean; text?: string; emsg?: string };
  setHeader(event, "content-type", "application/json");
  if (license.valid === false || typeof license.text !== "string") return license;

  const origin = getRequestURL(event).origin;
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin);
  return { valid: true, text: isLocal ? license.text : patchSportradarLicenseForOrigin(license.text, origin) };
});
