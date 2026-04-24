// x402 protocol types
// Spec: github.com/x402-foundation/x402
// Settlement layer — pay-per-request via HTTP 402 + ERC-20 permits

export interface PaymentRequirements {
  scheme: "exact" | "upto"
  network: string         // e.g. "eip155:8453" (Base mainnet)
  maxAmountRequired: string
  resource: string        // the URL being accessed
  description?: string
  payTo: string           // merchant wallet address
  asset: string           // ERC-20 contract address
  extra?: {
    name: string          // token name (e.g. "USDC")
    version: string       // token version for EIP-712
  }
}

export interface PaymentPayload {
  x402Version: number
  scheme: string
  network: string
  payload: {
    signature: string
    authorization: {
      from: string
      to: string
      value: string
      validAfter: string
      validBefore: string
      nonce: string
    }
  }
}
