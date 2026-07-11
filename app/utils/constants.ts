export const ACCOUNTS_STORAGE_KEY = "stance_accounts.v2";
export const STORAGE_KEY = "stance_account.v1";
export const LEGACY_STORAGE_KEY = "stance_account";

export const LEGACY_PAPERMARKET_ACCOUNTS_KEY = "papermarket_accounts.v2";
export const LEGACY_PAPERMARKET_STORAGE_KEY = "papermarket_account.v1";
export const LEGACY_PAPERMARKET_ACCOUNT_KEY = "papermarket_account";

export const WATCHLIST_STORAGE_KEY = "stance_watchlist";
export const LEGACY_PAPERMARKET_WATCHLIST_KEY = "papermarket_watchlist";

export const SIDEBAR_COLLAPSED_STORAGE_KEY = "stance_sidebar_collapsed";

export const THEME_STORAGE_KEY = "stance_theme";

export const MARKETS_PAGE_SIZE = 40;
export const DISPLAYED_MARKETS_LIMIT = 30;

export const HIDDEN_TAG_REGEX = /hide|^finance$|^equities$|^stocks$|^crypto$|^politics$/i;

export const SHARE_EPSILON = 1e-6;

export const CATEGORY_TAG_ALIASES: Record<string, string> = {
  culture: "pop-culture",
  mentions: "mention-markets",
};
