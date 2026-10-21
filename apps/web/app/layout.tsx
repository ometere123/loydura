import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { SiteShell } from "@/components/site-shell";
import "./globals.css";
export const metadata: Metadata = {
  title: "Loydura — Commerce that creates commitment",
  description: "Token-powered creator memberships and funded on-chain loyalty campaigns on Elysium.",
  openGraph: { title: "Loydura — Commerce that creates commitment", description: "Give your token a reason to exist." }
};
export default function Layout({children}:{children:React.ReactNode}){
  return <html lang="en"><body><Providers><SiteShell>{children}</SiteShell></Providers></body></html>;
}
