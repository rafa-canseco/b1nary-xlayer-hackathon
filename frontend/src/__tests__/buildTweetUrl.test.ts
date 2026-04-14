import { describe, it, expect } from "vitest";
import { buildTweetUrl } from "@/lib/utils";

describe("buildTweetUrl", () => {
  it("returns a Twitter intent URL for all modes", () => {
    for (const mode of ["buy", "sell", "range"] as const) {
      const url = buildTweetUrl(89, "ETH", mode);
      expect(url).toMatch(/^https:\/\/twitter\.com\/intent\/tweet\?text=/);
    }
  });

  it("buy — uses 'buy' template with USDC collateral", () => {
    const decoded = decodeURIComponent(buildTweetUrl(89, "ETH", "buy"));
    expect(decoded).toContain("Set the price I'd buy ETH at.");
    expect(decoded).toContain("89% APR on my USDC.");
  });

  it("sell — uses 'sell' template with asset collateral", () => {
    const decoded = decodeURIComponent(buildTweetUrl(120, "ETH", "sell"));
    expect(decoded).toContain("Set the price I'd sell ETH at.");
    expect(decoded).toContain("120% APR on my ETH.");
  });

  it("range — uses range template with USDC collateral", () => {
    const decoded = decodeURIComponent(buildTweetUrl(75, "ETH", "range"));
    expect(decoded).toContain("Got paid to set an ETH range.");
    expect(decoded).toContain("75% APR on my USDC.");
  });

  it("rounds APR to integer", () => {
    const decoded = decodeURIComponent(buildTweetUrl(44.7, "ETH", "buy"));
    expect(decoded).toContain("45% APR");
  });

  it("uses asset symbol dynamically (cbBTC)", () => {
    const decoded = decodeURIComponent(buildTweetUrl(80, "cbBTC", "sell"));
    expect(decoded).toContain("cbBTC");
  });

  it("includes @b1naryprotocol in all modes", () => {
    for (const mode of ["buy", "sell", "range"] as const) {
      const decoded = decodeURIComponent(buildTweetUrl(89, "ETH", mode));
      expect(decoded).toContain("@b1naryprotocol");
    }
  });

  it("includes b1nary.app in all modes", () => {
    for (const mode of ["buy", "sell", "range"] as const) {
      const decoded = decodeURIComponent(buildTweetUrl(89, "ETH", mode));
      expect(decoded).toContain("b1nary.app");
    }
  });

  it("URL-encodes the tweet text (no spaces in query param)", () => {
    for (const mode of ["buy", "sell", "range"] as const) {
      const url = buildTweetUrl(89, "ETH", mode);
      const textParam = url.split("text=")[1];
      expect(textParam).not.toContain(" ");
    }
  });

  it("contains no emoji, hashtags, or 'options'", () => {
    for (const mode of ["buy", "sell", "range"] as const) {
      const decoded = decodeURIComponent(buildTweetUrl(89, "ETH", mode));
      expect(decoded).not.toMatch(/#\w/);
      expect(decoded.toLowerCase()).not.toContain("option");
    }
  });

  it("range — uses correct article for cbBTC (non-vowel symbol)", () => {
    const decoded = decodeURIComponent(buildTweetUrl(80, "cbBTC", "range"));
    expect(decoded).toContain("Got paid to set a cbBTC range.");
    expect(decoded).not.toContain("an cbBTC");
  });
});
