"use client";

import * as React from "react";

const PortalAccentContext = React.createContext<React.CSSProperties | undefined>(
  undefined,
);

export interface PortalAccentProviderProps {
  value?: React.CSSProperties;
  children: React.ReactNode;
}

export function PortalAccentProvider({
  value,
  children,
}: PortalAccentProviderProps): React.JSX.Element {
  return (
    <PortalAccentContext.Provider value={value}>
      {children}
    </PortalAccentContext.Provider>
  );
}

export function usePortalAccent(): React.CSSProperties | undefined {
  return React.useContext(PortalAccentContext);
}
