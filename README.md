# x402 Example

Minimal implementation of the [x402 protocol](https://github.com/x402-foundation/x402) — HTTP 402 + ERC-20 permits for pay-per-request APIs.

Built to understand x402 from the inside. Implements a paid API endpoint and an agent that pays for access.

## What's here

- `src/server.ts` — x402 paid endpoint (TicketShop), returns 402 with payment requirements, delivers resource after payment
- `src/client.ts` — AI agent that handles the 402 flow: parse requirements, sign EIP-3009 permit, retry with X-PAYMENT header
- `src/types.ts` — x402 types (PaymentRequirements, PaymentPayload)
- `OBSERVATIONS.md` — What we learned implementing this from scratch

## Run it

```bash
npm install

# Terminal 1: start the server
npm run server

# Terminal 2: run the agent
npm run client
```

## Key observations

See [OBSERVATIONS.md](./OBSERVATIONS.md) for the full findings. The most important:

**x402 is the simplest protocol.** One HTTP round-trip: GET → 402 → sign permit → retry with header → resource delivered. No session, no mandate, no cart. The 402 response contains everything the agent needs. Perfect for API access and micropayments. Not designed for complex commerce.

**Stateless by design.** Each request is independent. The server doesn't track sessions, budgets, or history. An agent that makes 100 requests signs 100 permits. Budget enforcement is entirely external — x402 has no concept of spending limits.

## Protocol

x402 uses HTTP status 402 (Payment Required) as the payment discovery mechanism. Payment is an EIP-3009 TransferWithAuthorization signed off-chain (gasless). A facilitator settles the payment on-chain and returns the resource.

Compare with [acp-example](https://github.com/goodmeta/acp-example) (REST checkout), [ucp-example](https://github.com/goodmeta/ucp-example) (MCP checkout), [ap2-example](https://github.com/goodmeta/ap2-example) (authorization), and [mpp-example](https://github.com/goodmeta/mpp-example) (charge intent).
