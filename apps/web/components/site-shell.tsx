"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Github, Menu, X, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { WalletBar } from "@/components/wallet";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/discover", label: "Discover" },
  { href: "/studio", label: "Creator Studio" },
  { href: "/me", label: "My Dashboard" }
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => setMobileOpen(false), [pathname]);

  return <div className="app-frame">
    <header className="site-header">
      <div className="nav-shell">
        <Link href="/" className="brand" aria-label="Loydura home"><span className="brand-mark" aria-hidden="true"><span /></span><span className="brand-word">LOYDURA</span><span className="brand-caption">COMMERCE / COMMITMENT</span></Link>
        <nav className="desktop-nav" aria-label="Main navigation">{navigation.map(item => <Link key={item.href} href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined} className={isActive(pathname, item.href) ? "active" : ""}>{item.label}</Link>)}</nav>
        <div className="nav-wallet"><WalletBar /></div>
        <button className="menu-button" type="button" aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => setMobileOpen(value => !value)}>{mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}</button>
      </div>
      {mobileOpen && <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">{navigation.map(item => <Link key={item.href} href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined} className={isActive(pathname, item.href) ? "active" : ""}>{item.label}</Link>)}</nav>}
    </header>
    <main className="site-main">{children}</main>
    <footer className="site-footer"><div className="footer-grid"><div><Link href="/" className="footer-brand">LOYDURA<span>.</span></Link><p className="footer-copy">Commerce that creates commitment.</p><p className="footer-risk">Testnet assets have no monetary value. Rewards are not guaranteed.</p></div><div><p className="footer-label">Product</p><Link href="/discover">Discover</Link><Link href="/studio">Creator Studio</Link><Link href="/me">My Dashboard</Link></div><div><p className="footer-label">Network</p><a href="https://elysium.kinetiq.xyz/testnet-explorer" target="_blank" rel="noreferrer">Elysium explorer <ArrowUpRight size={12} aria-hidden="true" /></a><a href="https://github.com/ometere123/loydura" target="_blank" rel="noreferrer">GitHub <Github size={12} aria-hidden="true" /></a><span>Chain 99801 · HYPE gas</span></div><div><p className="footer-label">Transparency</p><Link href="/discover">Contract reads</Link><a href="https://github.com/ometere123/loydura/blob/main/docs/SECURITY.md" target="_blank" rel="noreferrer">Security notes <ArrowUpRight size={12} aria-hidden="true" /></a><span>Creator-submitted provenance is labeled.</span></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Loydura</span><span>Built for useful token economies.</span></div></footer>
  </div>;
}
