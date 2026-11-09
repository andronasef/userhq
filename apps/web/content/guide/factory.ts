import {
  Layers,
  ShieldCheck,
  Inbox,
  MessageSquare,
  MapPin,
  Globe,
  Route,
  BookOpen,
  Palette,
  KeyRound,
  Code2,
  Webhook,
} from "lucide-react";
import type { NavGroup, QuickLink, GuideHeaderInfo, GuideLocalePackage } from "./types";

export interface LocaleStrings {
  header: GuideHeaderInfo;
  groups: [string, string, string, string, string];
  items: {
    overview: string;
    rolesPermissions: string;
    requestsInbox: string;
    commentsAttention: string;
    authorLocation: string;
    customerPortals: string;
    roadmapChangelog: string;
    faqSystem: string;
    themesPush: string;
    apiOverview: string;
    swaggerExplorer: string;
    webhooksHmac: string;
  };
  quickLinks: {
    requestsInbox: { title: string; description: string };
    commentsAttention: { title: string; description: string };
    swaggerExplorer: { title: string; description: string };
    webhooksHmac: { title: string; description: string };
  };
}

export function buildGuidePackage(strings: LocaleStrings, markdown: string): GuideLocalePackage {
  const nav: NavGroup[] = [
    {
      title: strings.groups[0],
      items: [
        { id: "overview", label: strings.items.overview, icon: Layers },
        { id: "roles-permissions", label: strings.items.rolesPermissions, icon: ShieldCheck },
      ],
    },
    {
      title: strings.groups[1],
      items: [
        { id: "requests-inbox", label: strings.items.requestsInbox, icon: Inbox },
        { id: "comments-attention", label: strings.items.commentsAttention, icon: MessageSquare },
        { id: "author-location", label: strings.items.authorLocation, icon: MapPin },
      ],
    },
    {
      title: strings.groups[2],
      items: [
        { id: "customer-portals", label: strings.items.customerPortals, icon: Globe },
        { id: "roadmap-changelog", label: strings.items.roadmapChangelog, icon: Route },
        { id: "faq-system", label: strings.items.faqSystem, icon: BookOpen },
      ],
    },
    {
      title: strings.groups[3],
      items: [
        { id: "themes-push", label: strings.items.themesPush, icon: Palette },
      ],
    },
    {
      title: strings.groups[4],
      items: [
        { id: "api-overview", label: strings.items.apiOverview, icon: KeyRound },
        { id: "swagger-explorer", label: strings.items.swaggerExplorer, icon: Code2 },
        { id: "webhooks-hmac", label: strings.items.webhooksHmac, icon: Webhook },
      ],
    },
  ];

  const quickLinks: QuickLink[] = [
    {
      id: "requests-inbox",
      title: strings.quickLinks.requestsInbox.title,
      description: strings.quickLinks.requestsInbox.description,
      icon: Inbox,
      iconColor: "text-[var(--primary-text)]",
    },
    {
      id: "comments-attention",
      title: strings.quickLinks.commentsAttention.title,
      description: strings.quickLinks.commentsAttention.description,
      icon: MessageSquare,
      iconColor: "text-emerald-500",
    },
    {
      id: "swagger-explorer",
      title: strings.quickLinks.swaggerExplorer.title,
      description: strings.quickLinks.swaggerExplorer.description,
      icon: Code2,
      iconColor: "text-blue-500",
    },
    {
      id: "webhooks-hmac",
      title: strings.quickLinks.webhooksHmac.title,
      description: strings.quickLinks.webhooksHmac.description,
      icon: Webhook,
      iconColor: "text-purple-500",
    },
  ];

  return {
    header: strings.header,
    nav,
    quickLinks,
    markdown,
  };
}
