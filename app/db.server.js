import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

if (process.env.NODE_ENV !== "production") {
  try {
    console.log("🔄 Programmatically syncing Prisma schema with database...");
    execSync("npx prisma db push", { stdio: "inherit" });
    console.log("✅ Prisma schema synced successfully!");
  } catch (error) {
    console.error("❌ Failed to sync Prisma schema programmatically:", error);
  }

  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();

export default prisma;
