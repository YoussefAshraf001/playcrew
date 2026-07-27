import { use } from "react";
import UserProfileDashboard from "@/app/components/UserProfileDashboard";

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  return <UserProfileDashboard username={username} />;
}
