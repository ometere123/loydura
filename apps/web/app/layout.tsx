import type { Metadata } from "next";
import Link from "next/link";
import { Providers } from "@/components/providers";
import { WalletBar } from "@/components/wallet";
import "./globals.css";
export const metadata: Metadata = {title:"Loydura — Commerce Meets Commitment",description:"Creator-token memberships and funded on-chain commitment rewards on Elysium"};
export default function Layout({children}:{children:React.ReactNode}){
  return <html lang="en"><body><Providers>
    <header className="nav"><Link href="/" className="brand"><span className="brand-icon">L</span> LOYDURA</Link>
      <nav aria-label="Main navigation"><Link href="/">Discover</Link><Link href="/studio">Creator Studio</Link><Link href="/me">My Dashboard</Link></nav>
      <WalletBar/></header>
    <main>{children}</main>
    <footer className="footer"><span>LOYDURA · ELYSIUM TESTNET 99801</span><span>Testnet assets have no monetary value. Rewards are not guaranteed.</span></footer>
  </Providers></body></html>;
}
