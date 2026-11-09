import type { LucideIcon } from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface QuickLink {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
}

export interface GuideHeaderInfo {
  breadcrumbHome: string;
  breadcrumbCurrent: string;
  title: string;
  subtitle: string;
  searchPlaceholder: string;
}

export interface GuideLocalePackage {
  header: GuideHeaderInfo;
  nav: NavGroup[];
  quickLinks: QuickLink[];
  markdown: string;
}
