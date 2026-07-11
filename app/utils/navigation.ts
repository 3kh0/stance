export interface NavItem {
  label: string;
  to: string;
  icon: string;
}

export const NAV_TABS: NavItem[] = [
  { label: "Trending", to: "/", icon: "lucide:trending-up" },
  { label: "Breaking", to: "/breaking", icon: "lucide:zap" },
  { label: "New", to: "/new", icon: "lucide:sparkles" },
  { label: "Portfolio", to: "/portfolio", icon: "lucide:wallet" },
];

export const CATEGORY_TABS: NavItem[] = [
  { label: "Politics", to: "/politics", icon: "lucide:landmark" },
  { label: "Sports", to: "/sports", icon: "lucide:volleyball" },
  { label: "Elections", to: "/elections", icon: "lucide:vote" },
  { label: "Crypto", to: "/crypto", icon: "lucide:bitcoin" },
  { label: "Esports", to: "/esports", icon: "lucide:gamepad-2" },
  { label: "Finance", to: "/finance", icon: "lucide:banknote" },
  { label: "Earnings", to: "/earnings", icon: "lucide:badge-dollar-sign" },
  { label: "Geopolitics", to: "/geopolitics", icon: "lucide:earth" },
  { label: "Tech", to: "/tech", icon: "lucide:cpu" },
  { label: "Culture", to: "/culture", icon: "lucide:clapperboard" },
  { label: "Economy", to: "/economy", icon: "lucide:trending-up" },
  { label: "Weather", to: "/weather", icon: "lucide:cloud-sun" },
  { label: "Mentions", to: "/mentions", icon: "lucide:at-sign" },
];

export const ALL_PAGES: NavItem[] = [...NAV_TABS, ...CATEGORY_TABS];
