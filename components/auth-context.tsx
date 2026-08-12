"use client";

import { createContext, useContext } from "react";

import type { SemsRole } from "@/lib/access-control";

export type SyncStatus = "saved" | "saving" | "error";

export type SemsProfile = {
  id: string;
  email: string | null;
  display_name: string;
  department: string;
  role: SemsRole;
  active: boolean;
  organization_id: string | null;
  site_id?: string | null;
  organization?: { name: string } | null;
  site?: { name: string } | null;
};

type AuthContextValue = {
  profile: SemsProfile;
  syncStatus: SyncStatus;
  canWrite: boolean;
  canReview: boolean;
  canManage: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

export const WORKSPACE_CHANGE_EVENT = "sems2:workspace-change";

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useSemsAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useSemsAuth must be used inside AuthGate.");
  }
  return value;
}
