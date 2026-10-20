"use client";
import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, getDefaultConfig, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/query-core";
import { elysium } from "@loydura/chain";
import { useState } from "react";

const config = getDefaultConfig({
  appName: "Loydura",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
  chains: [elysium],
  ssr: true
});
export function Providers({children}:{children:React.ReactNode}) {
  const [queryClient]=useState(()=>new QueryClient({defaultOptions:{queries:{refetchOnWindowFocus:true,staleTime:5_000}}}));
  return <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider theme={darkTheme({accentColor:"#2ad5aa",accentColorForeground:"#0c1719"})}>
        {children}
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>;
}
