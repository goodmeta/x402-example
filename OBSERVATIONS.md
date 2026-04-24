# x402 Implementation Observations

Protocol: x402  
Spec: github.com/x402-foundation/x402  
Maintainers: x402 Foundation (originally Coinbase)  
Built: 2026-04-24

---

## 1. Simplest Protocol by Far

One HTTP round-trip: GET → 402 → sign → retry → done. No session, no mandate, no cart, no checkout lifecycle. The 402 response contains everything: how much, where to pay, what asset, what network.

An agent that can handle HTTP 402 and sign EIP-3009 can pay for any x402-gated resource. Nothing else to learn.

## 2. EIP-3009 vs ERC-2612

x402 uses EIP-3009 (TransferWithAuthorization), not ERC-2612 (Permit). The difference: EIP-3009 lets you specify the recipient in the signed message. The facilitator calls `transferWithAuthorization()` on-chain, which moves tokens directly from payer to payee in one transaction.

ERC-2612 would require two transactions: approve + transferFrom. EIP-3009 is cleaner for payments.

## 3. The Facilitator Is the Trust Anchor

The agent doesn't interact with the blockchain directly. The facilitator verifies the signature, settles on-chain, and returns the resource. The merchant trusts the facilitator to settle correctly.

This means facilitator choice matters. Using Coinbase's facilitator? You trust Coinbase. Using a permissionless facilitator? You trust whoever runs it. The x402 spec doesn't define facilitator certification or compliance requirements.

## 4. Stateless = No Budget Enforcement

Every request is independent. The server has no memory of previous payments. An agent making 100 requests signs 100 separate permits. Nothing in x402 tracks total spend, enforces a budget, or throttles an agent.

Budget enforcement must be external — either in the agent's runtime (per-wallet policy), in the facilitator (per-payer limits), or in a verification layer.

## 5. Perfect for API Access, Wrong for Commerce

x402 shines for API monetization: pay $0.01 per request, get the response. Simple, fast, no friction.

For complex commerce (items, fulfillment, tax, returns), x402 doesn't fit. You need ACP or UCP for that. x402 is the settlement rail, not the commerce layer.
