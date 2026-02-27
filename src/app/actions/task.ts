"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function completeTaskAction(id: string) {
  try {
    await prisma.task.update({
      where: { id },
      data: { status: "DONE" },
    });
    revalidatePath("/");
  } catch (error) {
    console.error("Failed to complete task:", error);
    throw new Error("Failed to complete task");
  }
}
