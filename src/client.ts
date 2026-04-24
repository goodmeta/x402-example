// x402 Agent Client — buys a conference ticket via x402 payment
//
// Flow:
//   1. GET /ticket → 402 + payment requirements
//   2. Sign ERC-20 permit (EIP-712, off-chain, gasless)
//   3. Retry GET /ticket with X-PAYMENT header
//   4. Server verifies via facilitator, returns the resource
//
// x402 is the simplest protocol: one HTTP round-trip with a payment header.
// No session. No mandate. No cart. Just pay and get.

import { privateKeyToAccount } from "viem/accounts"
import type { PaymentRequirements } from "./types.js"

const BASE_URL = `http://localhost:${process.env.PORT ?? 3000}`

function log(step: string, data: unknown) {
  console.log(`\n${"─".repeat(60)}`)
  console.log(`STEP: ${step}`)
  console.log("─".repeat(60))
  console.log(JSON.stringify(data, null, 2))
}

// EIP-3009 TransferWithAuthorization types (what x402 uses under the hood)
const TRANSFER_WITH_AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const

async function buyTicket() {
  console.log("x402 Agent — Buying TOKEN2049 VIP Pass")
  console.log("Protocol: x402 (HTTP 402 + ERC-20 permits)")
  console.log("Layer: Settlement (pay-per-request)\n")

  // Agent wallet (in production, from secure key management)
  const agentKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const
  const agentAccount = privateKeyToAccount(agentKey)

  // ── Step 1: Request the resource → get 402 ────────────────────────────
  const res = await fetch(`${BASE_URL}/ticket`)

  if (res.status !== 402) {
    console.log("Unexpected status:", res.status)
    return
  }

  const body = await res.json() as { paymentRequirements: PaymentRequirements[] }
  const requirements = body.paymentRequirements[0]

  log("1. GET /ticket → 402 Payment Required", {
    scheme: requirements.scheme,
    network: requirements.network,
    amount: requirements.maxAmountRequired,
    payTo: requirements.payTo,
    asset: requirements.asset,
    description: requirements.description,
  })

  // OBSERVATION: x402 is stateless. The 402 response contains everything
  // the agent needs: how much, where to pay, what network, what asset.
  // No session to create, no capability negotiation, no fulfillment step.
  // Compare to ACP (4 round-trips) or UCP (3 tool calls).

  // ── Step 2: Sign ERC-20 permit ────────────────────────────────────────
  // In production, this signs an EIP-3009 TransferWithAuthorization.
  // The permit authorizes the facilitator to move USDC from agent → merchant.
  // Off-chain (gasless) — no transaction needed until the facilitator settles.

  const nonce = `0x${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`.slice(0, 66) as `0x${string}`
  const validBefore = Math.floor(Date.now() / 1000) + 300 // 5 minutes

  const USDC_DOMAIN = {
    name: requirements.extra?.name ?? "USDC",
    version: requirements.extra?.version ?? "2",
    chainId: 8453, // Base mainnet
    verifyingContract: requirements.asset as `0x${string}`,
  } as const

  const signature = await agentAccount.signTypedData({
    domain: USDC_DOMAIN,
    types: TRANSFER_WITH_AUTH_TYPES,
    primaryType: "TransferWithAuthorization",
    message: {
      from: agentAccount.address,
      to: requirements.payTo as `0x${string}`,
      value: BigInt(requirements.maxAmountRequired),
      validAfter: 0n,
      validBefore: BigInt(validBefore),
      nonce: nonce as `0x${string}`,
    },
  })

  log("2. Sign ERC-20 permit (EIP-3009, off-chain)", {
    from: agentAccount.address,
    to: requirements.payTo,
    value: requirements.maxAmountRequired,
    signaturePrefix: signature.slice(0, 20) + "...",
  })

  // OBSERVATION: x402 uses EIP-3009 (TransferWithAuthorization), NOT
  // ERC-2612 (Permit). EIP-3009 allows specifying the recipient directly
  // in the signed message. The facilitator calls transferWithAuthorization()
  // on-chain to settle. One signature, one on-chain tx, done.

  // ── Step 3: Retry with X-PAYMENT header ───────────────────────────────
  const paymentPayload = {
    x402Version: 1,
    scheme: "exact",
    network: "eip155:8453",
    payload: {
      signature,
      authorization: {
        from: agentAccount.address,
        to: requirements.payTo,
        value: requirements.maxAmountRequired,
        validAfter: "0",
        validBefore: validBefore.toString(),
        nonce,
      },
    },
  }

  const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString("base64")

  const paidRes = await fetch(`${BASE_URL}/ticket`, {
    headers: { "X-PAYMENT": paymentHeader },
  })
  const ticket = await paidRes.json() as Record<string, unknown>

  log("3. GET /ticket with X-PAYMENT → resource delivered", ticket)

  // ── Summary ───────────────────────────────────────────────────────────
  const receiptHeader = paidRes.headers.get("X-PAYMENT-RECEIPT")
  const receipt = receiptHeader ? JSON.parse(receiptHeader) : null

  console.log("\n" + "═".repeat(60))
  console.log("PAYMENT COMPLETE (x402)")
  console.log("═".repeat(60))
  console.log(`Ticket:     ${(ticket["ticket"] as Record<string, unknown>)?.["title"]}`)
  console.log(`Amount:     $325.91 USDC`)
  console.log(`Network:    Base (eip155:8453)`)
  console.log(`Tx Hash:    ${receipt?.transactionHash ?? "n/a"}`)
  console.log("\nSee OBSERVATIONS.md for implementation notes.")
}

buyTicket().catch((err) => {
  console.error("Agent failed:", err)
  process.exit(1)
})
