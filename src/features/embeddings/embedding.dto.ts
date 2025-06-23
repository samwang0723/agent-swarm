import { z } from 'zod';

export const CreateEmbeddingSchema = z.object({
  userId: z.string().uuid(),
  sourceType: z.string(),
  sourceId: z.string().uuid(),
  content: z.string(),
});

export type CreateEmbeddingDto = z.infer<typeof CreateEmbeddingSchema>;

export interface EmailForEmbedding {
  id: string; // database id
  fromAddress?: string;
  subject?: string;
  body?: string;
}
