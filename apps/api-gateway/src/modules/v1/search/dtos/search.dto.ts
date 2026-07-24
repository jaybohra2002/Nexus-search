import { z } from 'zod';
export const SearchRequestSchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty'),
  k: z.number().int().min(1).max(50).default(10),
  alpha: z.number().min(0).max(1).default(0.5),
});
export type SearchRequestDTO = z.infer<typeof SearchRequestSchema>;
