import Link from "next/link";
import { ArrowUpRight, Check, CircleAlert, CircleDashed, LoaderCircle, ShieldCheck } from "lucide-react";
import { isPublicChainReady, publicConfig } from "@loydura/chain";

export function PageIntro({ eyebrow, title, description, actions }: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return <section className="page-intro">
    <div className="page-intro-copy"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lede">{description}</p></div>
    {actions && <div className="page-intro-actions">{actions}</div>}
  </section>;
}

export function SectionHeading({ eyebrow, title, description, action }: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return <div className="section-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2>{description && <p className="subtle">{description}</p>}</div>{action}</div>;
}

export function MetricCard({ label, value, detail, tone = "neutral" }: { label: string; value: React.ReactNode; detail?: string; tone?: "neutral" | "accent" | "gold" | "danger" }) {
  return <div className={`metric-card metric-${tone}`}><span className="metric-label">{label}</span><strong>{value}</strong>{detail && <span className="metric-detail">{detail}</span>}</div>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "accent" }) {
  return <span className={`status-badge status-${tone}`}><span className="status-dot" aria-hidden="true" />{children}</span>;
}

export function ChainConfigNotice() {
  if (isPublicChainReady) return null;
  return <div className="notice notice-warning" role="alert"><CircleAlert size={18} aria-hidden="true" /><div><strong>Live chain actions are unavailable.</strong><p>{publicConfig.issues.join(" ")} Add the public values from <code>apps/web/.env.example</code> before using wallet or contract features.</p></div></div>;
}

export function LoadingState({ label = "Loading verified data…" }: { label?: string }) {
  return <div className="state-panel state-loading" role="status"><LoaderCircle className="spin" size={22} aria-hidden="true" /><span>{label}</span></div>;
}

export function EmptyState({ icon = <CircleDashed size={24} />, title, description, action }: { icon?: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="state-panel state-empty"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{description}</p>{action && <div className="state-action">{action}</div>}</div>;
}

export function ErrorState({ title = "The live data could not be loaded.", description, onRetry }: { title?: string; description: string; onRetry?: () => void }) {
  return <div className="state-panel state-error" role="alert"><CircleAlert size={22} aria-hidden="true" /><div><h3>{title}</h3><p>{description}</p>{onRetry && <button className="button button-outline button-small" type="button" onClick={onRetry}>Try again</button>}</div></div>;
}

export function VerifiedLabel({ children = "Contract read" }: { children?: React.ReactNode }) {
  return <span className="verified-label"><ShieldCheck size={13} aria-hidden="true" />{children}</span>;
}

export function AddressValue({ value, label = "Address", explorer = false }: { value: string; label?: string; explorer?: boolean }) {
  const short = value.length > 14 ? `${value.slice(0, 7)}…${value.slice(-5)}` : value;
  const content = <span className="mono address-value" title={value}>{short}</span>;
  return <span className="address-line"><span className="tiny subtle">{label}</span>{explorer ? <a href={`https://elysium.kinetiq.xyz/testnet-explorer/address/${value}`} target="_blank" rel="noreferrer">{content}<ArrowUpRight size={12} aria-hidden="true" /></a> : content}</span>;
}

export function TransactionLink({ hash }: { hash: string }) {
  return <a className="transaction-link" href={`https://elysium.kinetiq.xyz/testnet-explorer/transaction/${hash}`} target="_blank" rel="noreferrer">View transaction <ArrowUpRight size={13} aria-hidden="true" /></a>;
}

export function StepList({ steps, current }: { steps: string[]; current?: number }) {
  return <ol className="step-list">{steps.map((step, index) => <li key={step} className={current !== undefined && index < current ? "step-done" : current === index ? "step-current" : ""}><span>{index < (current ?? -1) ? <Check size={14} aria-hidden="true" /> : index + 1}</span>{step}</li>)}</ol>;
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="back-link">← {children}</Link>;
}
