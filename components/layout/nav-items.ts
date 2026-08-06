export interface NavItem {
  label: string;
  href: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Today", href: "/dashboard" },
  { label: "Research", href: "/research" },
  { label: "Creator", href: "/studio" },
  { label: "Brand", href: "/brand" },
];
