import { PrismaClient } from '@prisma/client';

// Phase 2.2 mock for Prisma when running without a connected PostgreSQL database
let prisma: any;
try {
  if (process.env.DATABASE_URL) {
    prisma = new PrismaClient();
  } else {
    throw new Error('No DATABASE_URL configured');
  }
} catch {
  console.warn('[AI Studio] Database not connected — using mock');
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    findUniqueOrThrow: async () => ({}),
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {},
    delete: async () => ({}),
    aggregate: async () => ({ _sum: { amount: 0 } }),
  };
  prisma = new Proxy({}, {
    get: (_, prop) => {
      if (prop === '$transaction') {
        return async (fn: (tx: any) => Promise<any>) => fn(prisma);
      }
      return noOp;
    },
  });
}

export { prisma };
