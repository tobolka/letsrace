import { isAdminAuthenticated } from "@/lib/auth/admin";
import { redirect } from "next/navigation";

export async function requireAdminPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
}
