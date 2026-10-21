import { defineChain } from "viem";

// Direct public-env expressions are required for Next.js to inline the client
// configuration. The Worker build supplies a minimal process type and uses
// Wrangler's nodejs_compat runtime for this ABI-only shared package.
const publicRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://testnet-rpc.elysium.kinetiq.xyz";

export const elysium = defineChain({
  id: 99801,
  name: "Elysium Testnet",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: { default: { http: [publicRpcUrl] } },
  blockExplorers: { default: { name: "Elysium Explorer", url: "https://elysium.kinetiq.xyz/testnet-explorer" } },
  testnet: true
});

export const erc20Abi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }
] as const;

export const hubAbi = [
  { type: "function", name: "nextShopId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getShop", stateMutability: "view", inputs: [{name:"shopId", type:"uint256"}], outputs: [{type:"tuple", components:[{name:"creator",type:"address"},{name:"token",type:"address"},{name:"price",type:"uint256"},{name:"exists",type:"bool"}]}] },
  { type: "function", name: "membershipExpires", stateMutability: "view", inputs: [{type:"uint256"},{type:"address"}], outputs: [{type:"uint64"}] },
  { type: "function", name: "validThrough", stateMutability: "view", inputs: [{type:"uint256"},{type:"address"},{type:"uint256"}], outputs: [{type:"bool"}] },
  { type: "function", name: "createShop", stateMutability: "nonpayable", inputs: [{name:"token", type:"address"},{name:"price",type:"uint256"},{name:"recipients",type:"address[]"},{name:"weights",type:"uint16[]"}], outputs: [{type:"uint256"}] },
  { type: "function", name: "buyMembership", stateMutability: "nonpayable", inputs: [{type:"uint256"}], outputs: [{type:"uint64"}] },
  { type:"event", name:"ShopCreated", anonymous:false, inputs:[{name:"shopId",type:"uint256",indexed:true},{name:"creator",type:"address",indexed:true},{name:"token",type:"address",indexed:true},{name:"price",type:"uint256",indexed:false}] }
] as const;

const campaignComponents = [
  {name:"shopId",type:"uint256"},{name:"creator",type:"address"},{name:"token",type:"address"},
  {name:"start",type:"uint64"},{name:"end",type:"uint64"},{name:"lastUpdate",type:"uint64"},
  {name:"budget",type:"uint256"},{name:"rate",type:"uint256"},{name:"accPerShare",type:"uint256"},
  {name:"activeStake",type:"uint256"},{name:"refundable",type:"uint256"},{name:"refunded",type:"uint256"},
  {name:"claimed",type:"uint256"},{name:"totalForfeited",type:"uint256"},{name:"totalLocked",type:"uint256"},
  {name:"earlyExits",type:"uint256"},{name:"activeLockers",type:"uint256"},{name:"completed",type:"uint256"},
  {name:"pendingClaims",type:"uint256"},{name:"exists",type:"bool"}
] as const;
export const rewardsAbi = [
  {type:"function",name:"nextCampaignId",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]},
  {type:"function",name:"getCampaign",stateMutability:"view",inputs:[{type:"uint256"}],outputs:[{type:"tuple",components:campaignComponents}]},
  {type:"function",name:"getPosition",stateMutability:"view",inputs:[{type:"uint256"},{type:"address"}],outputs:[{type:"tuple",components:[{name:"amount",type:"uint256"},{name:"exists",type:"bool"},{name:"principalWithdrawn",type:"bool"},{name:"earlyExited",type:"bool"},{name:"claimed",type:"bool"},{name:"completionRecorded",type:"bool"}]}]},
  {type:"function",name:"previewEarned",stateMutability:"view",inputs:[{type:"uint256"},{type:"address"}],outputs:[{type:"uint256"}]},
  {type:"function",name:"createCampaign",stateMutability:"nonpayable",inputs:[{type:"uint256"},{type:"uint256"},{type:"uint64"},{type:"uint64"}],outputs:[{type:"uint256"}]},
  {type:"function",name:"lock",stateMutability:"nonpayable",inputs:[{type:"uint256"},{type:"uint256"}],outputs:[]},
  {type:"function",name:"unlock",stateMutability:"nonpayable",inputs:[{type:"uint256"}],outputs:[]},
  {type:"function",name:"claim",stateMutability:"nonpayable",inputs:[{type:"uint256"}],outputs:[]},
  {type:"function",name:"reclaim",stateMutability:"nonpayable",inputs:[{type:"uint256"}],outputs:[]},
  {type:"event",name:"CampaignCreated",anonymous:false,inputs:[{name:"campaignId",type:"uint256",indexed:true},{name:"shopId",type:"uint256",indexed:true},{name:"creator",type:"address",indexed:true},{name:"budget",type:"uint256",indexed:false},{name:"fee",type:"uint256",indexed:false},{name:"start",type:"uint64",indexed:false},{name:"end",type:"uint64",indexed:false}]}
] as const;

export const isAddress = (value: string): value is `0x${string}` => /^0x[a-fA-F0-9]{40}$/.test(value);
export const addresses = {
  hub: process.env.NEXT_PUBLIC_LOYDURA_HUB_ADDRESS ?? "",
  rewards: process.env.NEXT_PUBLIC_LOYDURA_REWARDS_ADDRESS ?? "",
  usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS ?? ""
};
