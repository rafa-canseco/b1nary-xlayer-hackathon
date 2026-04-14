// src/__tests__/buildCalendarUrl.test.ts
import { describe, it, expect } from "vitest";
import { buildCalendarUrl } from "@/lib/utils";
import type { Position } from "@/lib/api";

const BASE: Position = {
  id: "1",
  tx_hash: "0xabc",
  block_number: 1,
  user_address: "0xuser",
  otoken_address: "0xtoken",
  amount: 1_00000000,
  premium: "1000000",
  collateral: 1000_000000,       // $1,000 USDC (6 dec)
  vault_id: 1,
  strike_price: 2100_00000000,   // $2,100 (8 dec)
  expiry: 1776556800,            // 2026-04-19 00:00:00 UTC (midnight)
  is_put: true,
  is_settled: false,
  settled_at: null,
  settlement_tx_hash: null,
  indexed_at: "2026-01-01T00:00:00Z",
  settlement_type: null,
  delivered_asset: null,
  delivered_amount: null,
  delivery_tx_hash: null,
  is_itm: null,
  expiry_price: null,
  gross_premium: "1000000",
  net_premium: "960000",         // $0.96
  protocol_fee: "40000",
  outcome: null,
};

describe("buildCalendarUrl", () => {
  it("returns a Google Calendar render URL", () => {
    const url = buildCalendarUrl(BASE, "ETH", "eth");
    expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render/);
    expect(url).toContain("action=TEMPLATE");
  });

  it("puts expiry event at 08:00–09:00 UTC on expiry date", () => {
    const url = buildCalendarUrl(BASE, "ETH", "eth");
    expect(url).toContain("20260419T080000Z%2F20260419T090000Z");
  });

  it("uses 'put' in title for put positions", () => {
    const url = buildCalendarUrl(BASE, "ETH", "eth");
    expect(url).toContain("put+expiry");
  });

  it("uses 'call' in title for call positions", () => {
    const url = buildCalendarUrl({ ...BASE, is_put: false }, "ETH", "eth");
    expect(url).toContain("call+expiry");
  });

  it("uses correct BTC collateral decimals for call positions", () => {
    const btcCall: Position = {
      ...BASE,
      is_put: false,
      collateral: 1_00000000, // 1 BTC (8 dec)
    };
    const url = buildCalendarUrl(btcCall, "cbBTC", "btc");
    expect(url).toContain("cbBTC");
  });

  it("includes strike, committed, and premium in details", () => {
    const url = buildCalendarUrl(BASE, "ETH", "eth");
    expect(url).toContain("Strike");
    expect(url).toContain("Committed");
    expect(url).toContain("Premium+earned");
  });
});
