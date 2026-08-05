import { ProfileContent } from "@/features/profile/profile-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile",
  description: "Manage your account settings",
};

export default function ProfilePage() {
  return <ProfileContent />;
}
