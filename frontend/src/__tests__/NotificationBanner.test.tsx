// src/__tests__/NotificationBanner.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBanner } from "@/components/NotificationBanner";
import type { NotificationStatus } from "@/hooks/useNotificationStatus";

vi.mock("@/lib/api", () => ({
  api: {
    submitEmail: vi.fn(),
    verifyCode: vi.fn(),
    unsubscribe: vi.fn(),
  },
}));

vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({ user: null }),
}));

const baseStatus: NotificationStatus = {
  hasEmail: false,
  verified: false,
  unsubscribed: false,
  loading: false,
  error: false,
  refetch: vi.fn(),
};

describe("NotificationBanner", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders nothing when status.error is true", () => {
    const { container } = render(
      <NotificationBanner walletAddress="0xabc" status={{ ...baseStatus, error: true }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while loading", () => {
    const { container } = render(
      <NotificationBanner walletAddress="0xabc" status={{ ...baseStatus, loading: true }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders idle state when not verified", () => {
    render(<NotificationBanner walletAddress="0xabc" status={baseStatus} />);
    expect(screen.getByText("Get expiry reminders")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /set up/i })).toBeInTheDocument();
  });

  it("renders verified state when verified and not unsubscribed", () => {
    render(
      <NotificationBanner
        walletAddress="0xabc"
        status={{ ...baseStatus, verified: true, hasEmail: true }}
      />,
    );
    expect(screen.getByText("Notifications on")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /manage/i })).toBeInTheDocument();
  });

  it("shows email form when Set up is clicked", async () => {
    const user = userEvent.setup();
    render(<NotificationBanner walletAddress="0xabc" status={baseStatus} />);
    await user.click(screen.getByRole("button", { name: /set up/i }));
    expect(screen.getByPlaceholderText(/you@example\.com/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send code/i })).toBeInTheDocument();
  });
});
