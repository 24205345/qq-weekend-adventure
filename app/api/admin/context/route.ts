import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAdminSnapshot } from "@/lib/admin-data";
import { ensureMerchantForUser } from "@/lib/merchant";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "请先登录。" }, { status: 401 });
    const context = await ensureMerchantForUser(user);
    return Response.json(await getAdminSnapshot(context));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "后台加载失败。" },
      { status: 500 },
    );
  }
}
