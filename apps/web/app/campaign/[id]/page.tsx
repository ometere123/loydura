import { CampaignPanel } from "@/components/campaign";
import { notFound } from "next/navigation";
export default async function CampaignPage({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;if(!/^\d{1,15}$/.test(id)||Number(id)<1)notFound();
 return <CampaignPanel id={BigInt(id)}/>;
}
