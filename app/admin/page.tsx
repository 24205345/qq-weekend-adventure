import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { AdminDashboard } from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  return <AdminDashboard user={{ displayName: user.displayName, email: user.email }} />;
}
