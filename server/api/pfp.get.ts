import * as jdenticon from "jdenticon";

export default defineEventHandler((event) => {
  const x = Object.keys(getQuery(event))[0];
  if (!x) return "";
  setHeader(event, "Content-Type", "image/svg+xml");
  setHeader(event, "Cache-Control", "public, max-age=86400");
  return jdenticon.toSvg(x, 200, { backColor: "#fff" });
});
