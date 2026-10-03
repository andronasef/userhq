export const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export const DEFAULT_ACCENT = "#2563EB";

export const PALETTE = [
  { name: "Gray", hex: "#6B7280" },
  { name: "Red", hex: "#DC2626" },
  { name: "Orange", hex: "#EA580C" },
  { name: "Amber", hex: "#D97706" },
  { name: "Green", hex: "#16A34A" },
  { name: "Teal", hex: "#0D9488" },
  { name: "Blue", hex: "#2563EB" },
  { name: "Indigo", hex: "#4F46E5" },
  { name: "Purple", hex: "#9333EA" },
  { name: "Pink", hex: "#DB2777" },
] as const;

export type PaletteSwatch = (typeof PALETTE)[number];

export const STATUS_TYPES = [
  "review",
  "planned",
  "active",
  "completed",
  "closed",
] as const;

export type StatusType = (typeof STATUS_TYPES)[number];

export interface SeededStatus {
  name: string;
  type: StatusType;
  color: string;
  isDefault: boolean;
}

export const SEEDED_STATUSES: readonly SeededStatus[] = [
  {
    name: "Under Review",
    type: "review",
    color: "#EA580C",
    isDefault: true,
  },
  {
    name: "Planned",
    type: "planned",
    color: "#2563EB",
    isDefault: false,
  },
  {
    name: "In Progress",
    type: "active",
    color: "#9333EA",
    isDefault: false,
  },
  {
    name: "Completed",
    type: "completed",
    color: "#16A34A",
    isDefault: false,
  },
  {
    name: "Declined",
    type: "closed",
    color: "#6B7280",
    isDefault: false,
  },
] as const;
