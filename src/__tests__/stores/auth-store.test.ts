import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuthStore } from "@/stores/auth-store";
import type { User } from "@/types/database";

// Reset store between tests
beforeEach(() => {
  useAuthStore.setState({ user: null, isLoading: false });
});

const mockUser: User = {
  id: "user-1",
  auth_id: "auth-1",
  email: "test@example.com",
  first_name: "John",
  last_name: "Doe",
  role: "learner",
  organization_id: "org-1",
  status: "active",
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
  avatar_url: null,
  job_title: null,
  hire_date: null,
  manager_id: null,
  preferences: {},
};

describe("useAuthStore", () => {
  it("initializes with null user", () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it("sets user", () => {
    useAuthStore.getState().setUser(mockUser);
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  it("clears user", () => {
    useAuthStore.getState().setUser(mockUser);
    useAuthStore.getState().clearUser();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("fetchProfile sets loading state and fetches user", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockUser,
              error: null,
            }),
          }),
        }),
      }),
    };

    await useAuthStore.getState().fetchProfile(mockSupabase as never, "auth-1");

    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it("fetchProfile handles errors gracefully", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Not found" },
            }),
          }),
        }),
      }),
    };

    await useAuthStore.getState().fetchProfile(mockSupabase as never, "bad-id");

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});
