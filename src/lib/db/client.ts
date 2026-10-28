import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getConfig } from "@/lib/config/env";

const globalForPrisma = globalThis as unknown as { careerosPrisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: getConfig().databaseUrl });
  return new PrismaClient({ adapter });
}

export function getDb(): PrismaClient {
  // Reuse one client across hot reloads in development.
  globalForPrisma.careerosPrisma ??= createClient();
  return globalForPrisma.careerosPrisma;
}

export async function disconnectDb(): Promise<void> {
  if (globalForPrisma.careerosPrisma) {
    await globalForPrisma.careerosPrisma.$disconnect();
    globalForPrisma.careerosPrisma = undefined;
  }
}

export type Db = PrismaClient;
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
