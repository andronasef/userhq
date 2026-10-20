"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { PALETTE } from "@userhq/types";
import { accentTokens } from "@/lib/accent";
import { Input } from "./ui/input";

export interface ColorPreset {
  name: string;
  hex: string;
}

export interface ColorFieldProps {
  value: string;
  onChange: (hex: string) => void;
  label: string;
  description?: string;
  error?: string;
  disabled?: boolean;
  presets?: readonly ColorPreset[] | ColorPreset[];
  allowAuto?: boolean;
  autoLabel?: string;
  autoValue?: string;
  placeholder?: string;
  id?: string;
}

export function ColorField({
  value,
  onChange,
  label,
  description,
  error,
  disabled,
  presets = PALETTE,
  allowAuto = false,
  autoLabel = "Auto",
  autoValue,
  placeholder,
  id,
}: ColorFieldProps) {
  const normValue = value?.toUpperCase() ?? "";
  const isAutoSelected = allowAuto && (!normValue || normValue === "AUTO");
  const fieldId = id || React.useId();

  const previewColor = isAutoSelected
    ? autoValue || "#FFFFFF"
    : normValue || autoValue || "#FFFFFF";
  const tokens = accentTokens(previewColor);

  return (
    <div className="flex flex-col gap-3">
      {label && (
        <div className="flex flex-col gap-0.5">
          <label
            htmlFor={fieldId}
            className="text-sm font-medium text-foreground"
          >
            {label}
          </label>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <div
          role="radiogroup"
          aria-label={label}
          className="flex flex-wrap items-center gap-2"
        >
          {allowAuto && (
            <label className="relative flex items-center justify-center cursor-pointer rounded-full">
              <input
                type="radio"
                name={`${fieldId}-preset`}
                value=""
                checked={isAutoSelected}
                disabled={disabled}
                onChange={() => onChange("")}
                className="sr-only"
                aria-label={autoLabel}
              />
              <span
                className={`h-8 px-3 rounded-full border border-border flex items-center gap-1.5 text-xs transition-all ${
                  isAutoSelected
                    ? "bg-secondary text-secondary-foreground ring-2 ring-ring ring-offset-2 font-semibold shadow-xs"
                    : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {isAutoSelected && (
                  <Check className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>{autoLabel}</span>
                {autoValue && !isAutoSelected && (
                  <span className="text-[10px] text-muted-foreground opacity-75 font-mono">
                    ({autoValue})
                  </span>
                )}
              </span>
            </label>
          )}

          {presets.map((swatch) => {
            const isSelected =
              !isAutoSelected && normValue === swatch.hex.toUpperCase();
            const swatchTokens = accentTokens(swatch.hex);

            return (
              <label
                key={swatch.hex}
                className="relative flex items-center justify-center cursor-pointer rounded-full"
              >
                <input
                  type="radio"
                  name={`${fieldId}-preset`}
                  value={swatch.hex}
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() => onChange(swatch.hex)}
                  className="sr-only"
                  aria-label={swatch.name}
                />
                <span
                  style={{ backgroundColor: swatch.hex }}
                  className={`size-8 rounded-full border border-border/40 flex items-center justify-center transition-all ${
                    isSelected
                      ? "ring-2 ring-ring ring-offset-2 scale-105 shadow-xs"
                      : "hover:scale-105"
                  }`}
                  aria-label={swatch.name}
                  title={`${swatch.name} (${swatch.hex})`}
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
            className="size-6 rounded-md border border-border shrink-0 shadow-xs"
            style={{ backgroundColor: previewColor }}
            aria-hidden="true"
          />
          <div className="flex flex-col">
            <span className="sr-only">{label} custom hex</span>
            <Input
              id={fieldId}
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
              placeholder={
                placeholder ||
                (allowAuto
                  ? autoValue
                    ? `Auto (${autoValue})`
                    : "Auto"
                  : "#2563EB")
              }
              aria-label={`${label} custom hex`}
              className="w-36 font-mono text-xs"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
