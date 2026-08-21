import { updateBookingAdmin } from "./db";

export async function applyAdminBookingUpdate(input: {
  id: number;
  status?: "new" | "in_progress" | "completed" | "cancelled";
  adminNote?: string | null;
  adminOpenId: string;
  update?: typeof updateBookingAdmin;
}) {
  const update = input.update ?? updateBookingAdmin;
  return update({
    id: input.id,
    status: input.status,
    adminNote: input.adminNote,
    statusUpdatedBy: input.adminOpenId,
  });
}
