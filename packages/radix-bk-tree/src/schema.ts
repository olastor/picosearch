import { z } from 'zod';

export const getRadixBKTreeMapNodeSchema = (valueSchema: z.ZodType) =>
  z.object({
    i: z.boolean().optional(),
    get p() {
      return getRadixEdgeSchema(valueSchema).optional();
    },
    get b() {
      return getRadixBKTreeMapNodeSchema(valueSchema).optional();
    },
    get k() {
      return z
        .record(z.number(), getRadixBKTreeMapNodeSchema(valueSchema))
        .optional();
    },
    get r() {
      return z.array(getRadixEdgeSchema(valueSchema)).optional();
    },
    v: z.array(valueSchema).optional(),
  });

export const getRadixEdgeSchema = (valueSchema: z.ZodType) =>
  z.object({
    source: getRadixBKTreeMapNodeSchema(valueSchema),
    label: z.string(),
    target: getRadixBKTreeMapNodeSchema(valueSchema),
  });
