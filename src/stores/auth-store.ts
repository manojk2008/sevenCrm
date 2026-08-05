import { create } from "zustand";

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
}

const DEMO_USERS: Record<string, AuthUser> = {
  "rajesh@sevencrm.com": {
    id: "USR001",
    name: "Rajesh Kumar",
    email: "rajesh@sevencrm.com",
    role: "super-admin" as const,
    department: "Management",
  },
  "priya@sevencrm.com": {
    id: "USR002",
    name: "Priya Sharma",
    email: "priya@sevencrm.com",
    role: "admin" as const,
    department: "Operations",
  },
  "amit@sevencrm.com": {
    id: "USR003",
    name: "Amit Patel",
    email: "amit@sevencrm.com",
    role: "sales-manager" as const,
    department: "Sales",
  },
  "vikram@sevencrm.com": {
    id: "USR005",
    name: "Vikram Singh",
    email: "vikram@sevencrm.com",
    role: "sales-executive" as const,
    department: "Sales",
  },
};

export const useAuthStore = create<AuthState>()((set) => ({
  isAuthenticated: false,
  user: null,
  login: async (email: string, password: string) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const user = DEMO_USERS[email.trim().toLowerCase()];
    if (!user || password !== "password123") {
      throw new Error("Invalid email or password");
    }
    set({ isAuthenticated: true, user });
    return user;
  },
  logout: () => {
    set({ isAuthenticated: false, user: null });
  },
  setUser: (user) => set({ user }),
}));
