import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import * as apiModule from "@/lib/api";
import { useNotificationStatus } from "@/hooks/useNotificationStatus";

// Initialize jsdom if not available
beforeAll(async () => {
  if (typeof document === "undefined") {
    // @ts-expect-error jsdom types not installed
    const { JSDOM } = await import("jsdom");
    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
    (globalThis as any).document = dom.window.document;
    (globalThis as any).window = dom.window;
    (globalThis as any).navigator = dom.window.navigator;
  }
});

// Create a manual mock for getNotificationStatus
const createMockFn = () => {
  const calls: string[] = [];
  const responses: any[] = [];
  let responseIndex = 0;

  const mockFn = async (wallet: string) => {
    calls.push(wallet);
    if (responseIndex < responses.length) {
      const response = responses[responseIndex++];
      if (response instanceof Error) {
        throw response;
      }
      return response;
    }
    return { has_email: false, verified: false, unsubscribed: false };
  };

  mockFn.mockResolvedValueOnce = (value: any) => {
    responses.push(value);
    return mockFn;
  };

  mockFn.mockRejectedValueOnce = (error: Error) => {
    responses.push(error);
    return mockFn;
  };

  mockFn.mockClear = () => {
    calls.splice(0);
    responses.splice(0);
    responseIndex = 0;
  };

  // Fake toHaveBeenCalled for testing
  mockFn.toHaveBeenCalled = () => calls.length > 0;
  mockFn.toHaveBeenCalledTimes = (count: number) => calls.length === count;

  return mockFn;
};

const getNotificationStatusMock = createMockFn();

// Replace the api method with our mock
(apiModule.api as any).getNotificationStatus = getNotificationStatusMock;

describe("useNotificationStatus", () => {
  beforeEach(() => {
    getNotificationStatusMock.mockClear();
  });

  it("returns loading:true initially when address is provided", () => {
    getNotificationStatusMock.mockResolvedValueOnce({
      has_email: false,
      verified: false,
      unsubscribed: false,
    });
    const { result } = renderHook(() => useNotificationStatus("0xabc"));
    expect(result.current.loading).toBe(true);
  });

  it("returns parsed status on success", async () => {
    getNotificationStatusMock.mockResolvedValueOnce({
      has_email: true,
      verified: true,
      unsubscribed: false,
    });
    const { result } = renderHook(() => useNotificationStatus("0xabc"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasEmail).toBe(true);
    expect(result.current.verified).toBe(true);
    expect(result.current.unsubscribed).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it("sets error:true when fetch throws", async () => {
    getNotificationStatusMock.mockRejectedValueOnce(new Error("500"));
    const { result } = renderHook(() => useNotificationStatus("0xabc"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe(true);
    expect(result.current.hasEmail).toBe(false);
  });

  it("does not call api when walletAddress is undefined", () => {
    renderHook(() => useNotificationStatus(undefined));
    expect(getNotificationStatusMock.toHaveBeenCalled()).toBe(false);
  });

  it("re-fetches when refetch() is called", async () => {
    getNotificationStatusMock
      .mockResolvedValueOnce({ has_email: false, verified: false, unsubscribed: false })
      .mockResolvedValueOnce({ has_email: true, verified: true, unsubscribed: false });

    const { result } = renderHook(() => useNotificationStatus("0xabc"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.verified).toBe(false);

    result.current.refetch();
    await waitFor(() => expect(result.current.verified).toBe(true));
    expect(getNotificationStatusMock.toHaveBeenCalledTimes(2)).toBe(true);
  });
});
