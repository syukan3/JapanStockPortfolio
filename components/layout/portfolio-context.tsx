"use client";

import { createContext, useContext, useState } from "react";

type PortfolioContextType = {
  selectedPortfolioId: string | null;
  setSelectedPortfolioId: (id: string | null) => void;
};

const PortfolioContext = createContext<PortfolioContextType>({
  selectedPortfolioId: null,
  setSelectedPortfolioId: () => {},
});

export function PortfolioProvider({
  children,
  defaultPortfolioId,
}: {
  children: React.ReactNode;
  defaultPortfolioId: string | null;
}) {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(
    defaultPortfolioId
  );

  return (
    <PortfolioContext.Provider
      value={{ selectedPortfolioId, setSelectedPortfolioId }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  return useContext(PortfolioContext);
}
