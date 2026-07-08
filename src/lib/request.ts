import { z } from "zod";

export const preflightSchema = z.object({
  asset: z.enum(["BTC", "ETH", "SOL"]),
  side: z.enum(["LONG", "SHORT"]),
  notionalUsd: z.coerce.number().positive().max(250_000),
  leverage: z.coerce.number().min(1).max(20),
  thesis: z.string().min(12).max(1200),
  sourceAgent: z.string().min(2).max(80),
  userPolicy: z.object({
    maxNotionalUsd: z.coerce.number().positive().max(250_000),
    maxLeverage: z.coerce.number().min(1).max(20),
    requireHumanConfirmation: z.coerce.boolean(),
  }),
});
