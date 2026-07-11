interface ProfileSearchResponse {
  profiles?: Array<{
    name?: string;
    pseudonym?: string;
    displayUsernamePublic?: boolean;
    profileImage?: string;
    bio?: string;
    proxyWallet?: string;
  }>;
}

interface ProfileUserData {
  id?: string;
  createdAt?: string;
  name?: string;
  pseudonym?: string;
  displayUsernamePublic?: boolean;
  profileImage?: string;
  bio?: string;
  proxyWallet?: string;
  xUsername?: string;
  verifiedBadge?: boolean;
  takerTier?: number;
  takerTierName?: string;
}

interface ProfilePosition {
  asset?: string;
  conditionId?: string;
  size?: number;
  avgPrice?: number;
  initialValue?: number;
  currentValue?: number;
  cashPnl?: number;
  percentPnl?: number;
  curPrice?: number;
  title?: string;
  slug?: string;
  icon?: string;
  eventSlug?: string;
  outcome?: string;
  endDate?: string;
}

interface ProfileActivity {
  timestamp?: number;
  type?: string;
  side?: string;
  size?: number;
  usdcSize?: number;
  price?: number;
  title?: string;
  slug?: string;
  icon?: string;
  eventSlug?: string;
  outcome?: string;
  transactionHash?: string;
}

const ok = <T>(r: PromiseSettledResult<T>, fb: T): T => (r.status === "fulfilled" ? r.value : fb);

function requireUsername(value: string | undefined): string {
  const u = decodeURIComponent(value ?? "")
    .replace(/^@+/, "")
    .trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(u)) throw createError({ statusCode: 400, statusMessage: "Invalid profile username" });
  return u;
}

export default defineEventHandler(async (event) => {
  const username = requireUsername(getRouterParam(event, "username"));
  const search = await proxyUpstream<ProfileSearchResponse>(GAMMA_BASE_URL, "/search-v2", {
    q: username,
    optimized: true,
    limit_per_type: 10,
    type: "events",
    search_tags: false,
    search_profiles: true,
    cache: true,
  });

  const lower = username.toLowerCase();
  const seed = search.profiles?.find((p) => p.name?.toLowerCase() === lower) ?? search.profiles?.find((p) => p.pseudonym?.toLowerCase() === lower) ?? search.profiles?.[0];
  const wallet = coerceAddress(seed?.proxyWallet);
  if (!seed || !wallet) throw createError({ statusCode: 404, statusMessage: "Profile not found" });

  const [userDataR, valueR, positionsR, activityR] = await Promise.allSettled([
    proxyImpit<ProfileUserData | null>(POLYMARKET_BASE_URL, "/api/profile/userData", { address: wallet }),
    proxyUpstream<Array<{ user?: string; value?: number }>>(DATA_API_BASE_URL, "/value", { user: wallet }),
    proxyUpstream<ProfilePosition[]>(DATA_API_BASE_URL, "/positions", { user: wallet, sizeThreshold: 0.1, limit: 100, sortBy: "CURRENT", sortDirection: "DESC" }),
    proxyUpstream<ProfileActivity[]>(DATA_API_BASE_URL, "/activity", { user: wallet, limit: 100, offset: 0, sortBy: "TIMESTAMP", sortDirection: "DESC" }),
  ]);

  const userData = ok(userDataR, null);
  const positions = ok(positionsR, []);
  const activity = ok(activityR, []);
  const value = ok(valueR, [])[0]?.value ?? positions.reduce((t, p) => t + (Number(p.currentValue) || 0), 0);

  return {
    profile: {
      id: userData?.id,
      name: userData?.name ?? seed.name,
      pseudonym: userData?.pseudonym ?? seed.pseudonym,
      displayUsernamePublic: userData?.displayUsernamePublic ?? seed.displayUsernamePublic,
      profileImage: userData?.profileImage ?? seed.profileImage,
      bio: userData?.bio ?? seed.bio,
      proxyWallet: wallet,
      createdAt: userData?.createdAt,
      xUsername: userData?.xUsername,
      verifiedBadge: userData?.verifiedBadge,
      takerTier: userData?.takerTier,
      takerTierName: userData?.takerTierName,
    },
    stats: {
      positionsValue: value,
      openPnl: positions.reduce((t, p) => t + (Number(p.cashPnl) || 0), 0),
      largestOpenWin: positions.reduce((m, p) => Math.max(m, Number(p.cashPnl) || 0), 0),
      positions: positions.length,
      activity: activity.length,
    },
    positions,
    activity,
  };
});
