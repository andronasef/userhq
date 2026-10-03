"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { PALETTE } from "@userhq/types";
import { accentTokens } from "@/lib/accent";
import { Input } from "./ui/input";

export interface ColorFieldProps {
  value: string;
  onChange: (hex: string) => void;
  label: string;
  error?: string;
  disabled?: boolean;
}

export function ColorField({
  value,
  onChange,
  label,
  error,
  disabled,
}: ColorFieldProps) {
  const normValue = value?.toUpperCase() ?? "";
  const tokens = accentTokens(normValue);

  return (
    <div className="flex flex-col gap-3">
      {label && <label className="text-sm font-medium">{label}</label>}

      <div className="flex flex-wrap items-center gap-4">
        <div
          role="radiogroup"
          aria-label={label}
          className="flex flex-wrap items-center gap-2"
        >
          {PALETTE.map((swatch) => {
            const isSelected = normValue === swatch.hex.toUpperCase();
            const swatchTokens = accentTokens(swatch.hex);

            return (
              <label
                key={swatch.hex}
                className="relative flex items-center justify-center cursor-pointer rounded-full"
              >
                <input
                  type="radio"
                  name="color-preset"
                  value={swatch.hex}
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() => onChange(swatch.hex)}
                  className="sr-only"
                  aria-label={swatch.name}
                />
                <span
                  style={{ backgroundColor: swatch.hex }}
                  className={`size-8 rounded-full flex items-center justify-center transition-all ${
                    isSelected
                      ? "ring-2 ring-ring ring-offset-2"
                      : "hover:scale-105"
                  }`}
                  aria-label={swatch.name}
                >
                  {isSelected && (
                    <Check
                      className="size-4"
                      style={{ color: swatchTokens.primaryForeground }}
                      aria-hidden="true"
                    />
                  )}
                </span>
              </label>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div
            className="size-6 rounded-md border border-border shrink-0"
            style={{ backgroundColor: tokens.primary }}
            aria-hidden="true"
          />
          <div className="flex flex-col">
            <span className="sr-only">Custom color (hex)</span>
            <Input
              type="text"
              value={value}
              disabled={disabled}
              onChange={(e) => {
                let v = e.target.value.trim().toUpperCase();
                if (v && !v.startsWith("#")) {
                  v = "#" + v;
                }
                onChange(v);
              }}
              placeholder="#2563EB"
              aria-label="Custom color (hex)"
              className="w-32 font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
