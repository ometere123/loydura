import { defineChain } from "viem";

// Keep every public environment reference explicit. Next.js only inlines
// statically analyzable NEXT_PUBLIC_* expressions into the browser bundle.
// The RPC has a documented local fallback so ABI-only Worker imports remain
// valid, while contract addresses are never silently replaced with defaults.
const configuredRpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "";
const publicRpcUrl = configuredRpcUrl || "https://testnet-rpc.elysium.kinetiq.xyz";

export const isAddress = (value: string): value is `0x${string}` => /^0x[a-fA-F0-9]{40}$/.test(value);

export const addresses = {
  hub: process.env.NEXT_PUBLIC_LOYDURA_HUB_ADDRESS ?? "",
  rewards: process.env.NEXT_PUBLIC_LOYDURA_REWARDS_ADDRESS ?? "",
  usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS ?? ""
};

export const publicConfig = {
  rpcUrl: configuredRpcUrl,
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  chainId: 99801,
  issues: [
    ...(!isAddress(addresses.hub) ? ["Hub contract address is missing or invalid."] : []),
    ...(!isAddress(addresses.rewards) ? ["Rewards contract address is missing or invalid."] : []),
    ...(!isAddress(addresses.usdc) ? ["USDC contract address is missing or invalid."] : []),
    ...(!/^https?:\/\//.test(configuredRpcUrl) ? ["Elysium RPC URL is missing or invalid."] : []),
    ...(!(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "").trim() ? ["WalletConnect project ID is missing."] : [])
  ]
};

export const isPublicChainReady = publicConfig.issues.length === 0;

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
  { type:"event", name:"ShopCreated", anonymous:false, inputs:[{name:"shopId",type:"uint256",indexed:true},{name:"creator",type:"address",indexed:true},{name:"token",type:"address",indexed:true},{name:"price",type:"uint256",indexed:false}] },
  { type:"event", name:"MembershipPurchased", anonymous:false, inputs:[{name:"shopId",type:"uint256",indexed:true},{name:"buyer",type:"address",indexed:true},{name:"expiresAt",type:"uint64",indexed:false},{name:"grossAmount",type:"uint256",indexed:false},{name:"fee",type:"uint256",indexed:false}] },
  { type:"event", name:"ShopPayout", anonymous:false, inputs:[{name:"shopId",type:"uint256",indexed:true},{name:"recipient",type:"address",indexed:true},{name:"amount",type:"uint256",indexed:false}] }
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
  {type:"event",name:"CampaignCreated",anonymous:false,inputs:[{name:"campaignId",type:"uint256",indexed:true},{name:"shopId",type:"uint256",indexed:true},{name:"creator",type:"address",indexed:true},{name:"budget",type:"uint256",indexed:false},{name:"fee",type:"uint256",indexed:false},{name:"start",type:"uint64",indexed:false},{name:"end",type:"uint64",indexed:false}]},
  {type:"event",name:"Locked",anonymous:false,inputs:[{name:"campaignId",type:"uint256",indexed:true},{name:"member",type:"address",indexed:true},{name:"amount",type:"uint256",indexed:false}]},
  {type:"event",name:"Unlocked",anonymous:false,inputs:[{name:"campaignId",type:"uint256",indexed:true},{name:"member",type:"address",indexed:true},{name:"amount",type:"uint256",indexed:false},{name:"early",type:"bool",indexed:false},{name:"forfeited",type:"uint256",indexed:false}]},
  {type:"event",name:"RewardClaimed",anonymous:false,inputs:[{name:"campaignId",type:"uint256",indexed:true},{name:"member",type:"address",indexed:true},{name:"amount",type:"uint256",indexed:false}]},
  {type:"event",name:"CreatorReclaimed",anonymous:false,inputs:[{name:"campaignId",type:"uint256",indexed:true},{name:"creator",type:"address",indexed:true},{name:"amount",type:"uint256",indexed:false}]},
  {type:"event",name:"RewardsAccrued",anonymous:false,inputs:[{name:"campaignId",type:"uint256",indexed:true},{name:"emission",type:"uint256",indexed:false},{name:"idle",type:"bool",indexed:false}]}
] as const;
// End of the public ABI exports.
