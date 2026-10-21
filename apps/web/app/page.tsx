import Link from "next/link";
import { ArrowRight, Coins, Sparkles, Store, WalletCards } from "lucide-react";

const solutionSteps = [
  ["01", "Create a storefront", "Give your token a real product surface: a membership, a creator identity, and protected resources."],
  ["02", "Sell useful access", "Members pay in the creator token and receive a time-bound relationship they can understand."],
  ["03", "Fund commitment", "Creators pre-fund a USDC reward pool with fixed start, end, and settlement rules."],
  ["04", "Reward the finish", "Members who complete the commitment can claim their earned rewards and recover principal."],
];

export default function Home() {
  return <div className="home-page">
    <section className="home-hero" aria-labelledby="hero-title">
      <div className="home-hero-copy">
        <p className="eyebrow">TOKEN UTILITY / ELYSIUM TESTNET 99801</p>
        <h1 id="hero-title">Give your token a <em>reason to exist.</em></h1>
        <p>Sell memberships in your token. Give members something valuable. Reward the commitment that lasts.</p>
        <div className="hero-actions"><Link className="button button-primary button-large" href="/studio">Launch a storefront <ArrowRight size={16} aria-hidden="true" /></Link><Link className="button button-outline button-large" href="/discover">Explore creators</Link></div>
        <p className="hero-footnote">Commerce that creates commitment — with the rules visible before anyone signs.</p>
      </div>
      <div className="hero-visual" aria-label="Illustrative Loydura membership and reward flow">
        <div className="visual-topline"><span>LOYDURA / COMMITMENT LOOP</span><span>LIVE DESIGN</span></div>
        <div className="commitment-map">
          <div className="map-node map-node-primary"><span className="map-icon"><Store size={19} aria-hidden="true" /></span><div><strong>Creator storefront</strong><small>Membership priced in the creator token</small></div></div>
          <span className="map-connector" aria-hidden="true" />
          <div className="map-node"><span className="map-icon"><WalletCards size={19} aria-hidden="true" /></span><div><strong>Member commitment</strong><small>Access purchased · tokens locked</small></div></div>
          <span className="map-connector" aria-hidden="true" />
          <div className="map-node"><span className="map-icon"><Coins size={19} aria-hidden="true" /></span><div><strong>Funded loyalty pool</strong><small>USDC streams over a fixed campaign</small></div></div>
        </div>
        <div className="visual-bottom"><div><strong>30 days</strong><span>access period</span></div><div><strong>USDC</strong><span>reward settlement</span></div><div><strong>on-chain</strong><span>rules & receipts</span></div></div>
      </div>
    </section>

    <section className="home-section" aria-labelledby="problem-title">
      <div className="home-section-heading"><p className="eyebrow">THE UTILITY GAP</p><h2 id="problem-title">A launch is not a relationship.</h2><p>Putting a token on-chain creates an asset. It does not create a reason for anyone to use it after launch day.</p></div>
      <div className="problem-grid"><article className="problem-card"><p className="eyebrow">THE PROBLEM</p><h3>Speculation is easy to start.</h3><p>Without a useful product around it, a creator token can become a moment of attention rather than an ongoing customer relationship. The token moves, but the creator has no durable commerce loop.</p></article><article className="problem-card problem-card-emphasis"><p className="eyebrow">THE QUESTION</p><h3>What does holding unlock?</h3><p>Loydura turns a token into an access key, a membership payment, and a visible commitment. It does not promise a price increase or protect anyone from market risk.</p></article></div>
    </section>

    <section className="home-section" aria-labelledby="solution-title">
      <div className="home-section-heading"><p className="eyebrow">THE LOYDURA LOOP</p><h2 id="solution-title">Utility with a beginning, middle, and finish.</h2><p>One coherent workflow connects creator commerce, protected content, and funded loyalty without moving custody or settlement off-chain.</p></div>
      <div className="solution-layout"><div className="solution-steps">{solutionSteps.map(([number, title, description]) => <div className="solution-step" key={number}><span className="solution-number">{number}</span><div><h3>{title}</h3><p>{description}</p></div></div>)}</div><aside className="solution-aside"><Sparkles size={24} color="var(--lime)" aria-hidden="true" /><h3>Designed for the moment after launch.</h3><p>Creators keep their own wallets. Members see the membership terms before paying. The campaign contract keeps the reward pool, principal, and forfeiture rules legible.</p><Link className="text-link" href="/discover">See the live product surface <ArrowRight size={14} aria-hidden="true" /></Link></aside></div>
    </section>

    <section className="home-section" aria-labelledby="roles-title">
      <div className="home-section-heading"><p className="eyebrow">TWO SIDES / ONE ECONOMY</p><h2 id="roles-title">A better loop for creators and members.</h2></div>
      <div className="role-grid"><article className="role-card creator"><p className="eyebrow">FOR CREATORS</p><h3>Make the token useful on purpose.</h3><p>Launch a storefront that feels like a product, not a contract address.</p><ul className="role-list"><li>Token-priced memberships</li><li>Revenue distribution to fixed recipients</li><li>Private member content in R2</li><li>Sponsored USDC loyalty campaigns</li><li>Transparent payment records</li></ul><Link className="button button-primary" href="/studio">Create your storefront <ArrowRight size={15} aria-hidden="true" /></Link></article><article className="role-card member"><p className="eyebrow">FOR MEMBERS</p><h3>Know what your commitment means.</h3><p>Discover real creator products and see the status of every position from one wallet.</p><ul className="role-list"><li>Browse creator memberships</li><li>Access paid digital resources</li><li>Lock tokens in eligible campaigns</li><li>Monitor commitment progress</li><li>Claim earned USDC after completion</li></ul><Link className="button button-outline" href="/discover">Explore memberships <ArrowRight size={15} aria-hidden="true" /></Link></article></div>
    </section>

    <section className="home-section" aria-labelledby="rules-title"><div className="rules-panel"><div><p className="eyebrow">TRANSPARENT FINANCIAL RULES</p><h2 id="rules-title">No black boxes behind the promise.</h2></div><ul className="rules-list"><li>The creator funds the reward pool upfront.</li><li>Locked token principal remains recoverable.</li><li>Early exits forfeit unpaid rewards.</li><li>Rewards become claimable after the campaign ends.</li><li>Payouts depend on the funded pool and participant behavior.</li><li>No guaranteed profit or market-price protection is offered.</li></ul></div></section>

    <section className="home-section" aria-labelledby="ascend-title"><div className="ascend-panel"><div><p className="eyebrow">ASCEND × ELYSIUM</p><h2 id="ascend-title">Give launched tokens somewhere useful to go.</h2><p>Loydura is designed for creators building token utility on Elysium, including creator-submitted Ascend launch references. A submitted link is labeled as creator-provided; it is not independent provenance, certification, sponsorship, or endorsement.</p><div className="hero-actions"><Link className="button button-outline" href="/studio">Build the utility layer</Link></div></div><div className="ascend-mark" aria-hidden="true">utility<br />over<br />hype</div></div></section>

    <section className="closing-cta" aria-labelledby="closing-title"><div><p className="eyebrow">MAKE THE NEXT MOVE COUNT</p><h2 id="closing-title">Start with a storefront. Earn the commitment.</h2></div><div className="hero-actions"><Link className="button button-primary button-large" href="/studio">Launch a storefront <ArrowRight size={16} aria-hidden="true" /></Link><Link className="button button-outline button-large" href="/discover">Explore creators</Link></div></section>
  </div>;
}
