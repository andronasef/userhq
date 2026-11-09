export * from "./types";
export * from "./factory";
export * from "./registry";

import { GUIDE_PACKAGES } from "./registry";

export const GUIDE_NAV_EN = GUIDE_PACKAGES["en"].nav;
export const GUIDE_NAV_AR = GUIDE_PACKAGES["ar"].nav;

export const GUIDE_HEADER_EN = GUIDE_PACKAGES["en"].header;
export const GUIDE_HEADER_AR = GUIDE_PACKAGES["ar"].header;

export const GUIDE_QUICK_LINKS_EN = GUIDE_PACKAGES["en"].quickLinks;
export const GUIDE_QUICK_LINKS_AR = GUIDE_PACKAGES["ar"].quickLinks;

export const GUIDE_MARKDOWN_EN = GUIDE_PACKAGES["en"].markdown;
export const GUIDE_MARKDOWN_AR = GUIDE_PACKAGES["ar"].markdown;
