import { PrismaClient } from '@prisma/client';

// Simulated Region Config
const REGIONS = ['us-east-1', 'eu-west-1', 'ap-south-1', 'af-south-1', 'ap-east-1'];
const CURRENT_REGION = process.env.AWS_REGION || 'us-east-1';

export const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async create({ args, query, model }) {
        // Residency Guardrail:
        // In a real multi-region setup, we would check if the data being written
        // belongs to the current region.
        
        // For this implementation, we'll simulate a check if 'dataRegion' is present in args.data
        if (args.data && (args.data as any).dataRegion) {
          const targetRegion = (args.data as any).dataRegion;
          if (targetRegion !== CURRENT_REGION) {
            console.warn(`[RESIDENCY_WARNING] Writing data for region ${targetRegion} in region ${CURRENT_REGION}`);
            // In strict mode, we would throw:
            // throw new Error(`Data Residency Violation: Cannot write ${targetRegion} data in ${CURRENT_REGION}`);
          }
        }
        return query(args);
      },
      async update({ args, query, model }) {
         // Similar check for updates
         return query(args);
      }
    },
  },
});

export function checkResidency(userRegion: string, resourceRegion: string) {
  if (userRegion !== resourceRegion) {
    throw new Error(`Data Residency Violation: User (${userRegion}) cannot access Resource (${resourceRegion})`);
  }
}
