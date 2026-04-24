// x402 Merchant Server — TicketShop
// Implements the x402 protocol (HTTP 402 + ERC-20 permits)
// Spec: github.com/x402-foundation/x402
//
// x402 is the SETTLEMENT layer — pay-per-request.
// No session. No cart. No mandate. Just:
//   1. Agent requests a resource
//   2. Server returns 402 with payment requirements
//   3. Agent signs an ERC-20 permit and retries with X-PAYMENT header
//   4. Server verifies payment via facilitator and returns the resource
//
// Endpoints:
//   GET /ticket — returns ticket data (paid resource, requires x402 payment)

import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { logger } from "hono/logger"
import type { PaymentRequirements, PaymentPayload } from "./types.js"

const PORT = Number(process.env.PORT ?? 3000)
const MERCHANT_WALLET = "0x1234567890abcdef1234567890abcdef12345678"
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "https://x402.org"

// Product (same TicketShop as all other examples)
const TICKET = {
  id: "token2049-vip",
  title: "TOKEN2049 Singapore VIP Pass",
  price_usdc: "325910000", // $325.91 in USDC base units (6 decimals)
  description: "VIP access to TOKEN2049 Singapore, Oct 7-8 2026",
}

const paymentRequirements: PaymentRequirements = {
  scheme: "exact",
  network: "eip155:8453", // Base mainnet
  maxAmountRequired: TICKET.price_usdc,
  resource: "/ticket",
  description: TICKET.title,
  payTo: MERCHANT_WALLET,
  asset: USDC_BASE,
  extra: { name: "USDC", version: "2" },
}

const app = new Hono()
app.use(logger())

// GET /ticket — the paid resource
app.get("/ticket", async (c) => {
  const paymentHeader = c.req.header("X-PAYMENT")

  // No payment → 402 with requirements
  if (!paymentHeader) {
    console.log("[x402] No payment header — returning 402")
    return c.json(
      {
        error: "Payment Required",
        paymentRequirements: [paymentRequirements],
      },
      402
    )
  }

  // Payment provided → verify via facilitator
  let payment: PaymentPayload
  try {
    payment = JSON.parse(Buffer.from(paymentHeader, "base64").toString())
  } catch {
    return c.json({ error: "Invalid X-PAYMENT header" }, 400)
  }

  // In production, we'd POST to the facilitator to verify + settle:
  //   POST ${FACILITATOR_URL}/verify
  //   POST ${FACILITATOR_URL}/settle
  // Here we simulate successful verification.
  const isValid = payment.scheme === "exact" && payment.network === "eip155:8453"

  if (!isValid) {
    return c.json({ error: "Payment verification failed" }, 402)
  }

  console.log(`[x402] Payment verified — delivering ticket`)

  // Set receipt header
  c.header("X-PAYMENT-RECEIPT", JSON.stringify({
    transactionHash: `0x${crypto.randomUUID().replace(/-/g, "")}`,
    network: "eip155:8453",
  }))

  // Return the paid resource
  return c.json({
    ticket: {
      id: TICKET.id,
      title: TICKET.title,
      status: "confirmed",
      attendee: payment.payload?.authorization?.from ?? "unknown",
      validFor: "TOKEN2049 Singapore, Oct 7-8 2026",
    },
  })
})

// GET /payment-requirements — explicit discovery (optional, not in spec)
app.get("/payment-requirements", (c) => {
  return c.json({ paymentRequirements: [paymentRequirements] })
})

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[x402] TicketShop server running on http://localhost:${PORT}`)
  console.log(`[x402] Product: ${TICKET.title} — $325.91 USDC`)
  console.log(`[x402] Payment: x402 exact scheme, USDC on Base`)
  console.log(`[x402] Facilitator: ${FACILITATOR_URL}`)
})
