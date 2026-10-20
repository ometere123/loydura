import { CreateCampaignForm, CreateShopForm } from "@/components/actions";
import { ContentEditor } from "@/components/content";
export default function Studio(){return <div className="stack wide"><section className="heading"><div><p className="eyebrow">CREATOR TOOLKIT</p><h1>Launch your utility.</h1>
 <p className="subtle">Connect and sign in with your Elysium wallet before publishing. Shops and campaign funding happen entirely through on-chain transactions.</p></div></section>
 <div className="grid2"><CreateShopForm/><CreateCampaignForm/></div><ContentEditor/>
 <div className="panel"><h3>Before funding a campaign</h3><p>Ensure members have enough time to buy or renew membership, then lock before the campaign begins. The entire reward budget and platform fee are transferred on campaign creation. Funds are not insured; use test assets only.</p></div>
 </div>}
