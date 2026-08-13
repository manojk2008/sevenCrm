import { create } from "zustand";
import { fetchSession, signInWithEmail, signOut, type BackendCrmRole, type BackendSessionUser } from "@/lib/auth-client";

export type UserRole = "super-admin" | "admin" | "sales-manager" | "sales-executive";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  department: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  setUser: (user: AuthState["user"]) => void;
  /** Restores auth state from the real Better Auth session cookie (e.g. after a page refresh). */
  hydrate: () => Promise<void>;
}

const ROLE_FROM_BACKEND: Record<BackendCrmRole, UserRole> = {
  SUPER_ADMIN: "super-admin",
  ADMIN: "admin",
  SALES_EXECUTIVE: "sales-executive",
};

function toAuthUser(backendUser: BackendSessionUser): AuthUser {
  return {
    id: backendUser.id,
    name: backendUser.name,
    email: backendUser.email,
    role: ROLE_FROM_BACKEND[backendUser.crmRole],
    department: backendUser.department,
  };
}

export const useAuthStore = create<AuthState>()((set) => ({
  isAuthenticated: false,
  user: null,
  login: async (email: string, password: string) => {
    const backendUser = await signInWithEmail(email, password);
    const user = toAuthUser(backendUser);
    set({ isAuthenticated: true, user });
    return user;
  },
  logout: () => {
    set({ isAuthenticated: false, user: null });
    // Best-effort: clear the real session cookie server-side too. Local
    // state is already cleared above regardless of whether this succeeds.
    void signOut().catch(() => {});
  },
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  hydrate: async () => {
    try {
      const session = await fetchSession();
      if (session?.user) {
        set({ isAuthenticated: true, user: toAuthUser(session.user) });
      } else {
        set({ isAuthenticated: false, user: null });
      }
    } catch {
      set({ isAuthenticated: false, user: null });
    }
  },
}));
