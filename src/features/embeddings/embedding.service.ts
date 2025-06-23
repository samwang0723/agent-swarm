import { createOpenAI } from '@ai-sdk/openai';
import {
  batchInsertEmbeddings,
  searchEmbeddings,
  SearchResult,
} from './embedding.repository';
import { embed, embedMany } from 'ai';
import { EmailForEmbedding } from './embedding.dto';

// Initialize the OpenAI client for embeddings
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Specify the embedding model, e.g., 'text-embedding-3-small'
const embeddingModel = openai.embedding('text-embedding-3-small');

export class EmbeddingService {
  async createEmbeddingsForEmails(userId: string, emails: EmailForEmbedding[]) {
    if (emails.length === 0) {
      return;
    }

    const contentsToEmbed = emails.map(
      email =>
        `${email.fromAddress || ''} ${email.subject || ''} ${email.body || ''}`
    );

    try {
      const { embeddings } = await embedMany({
        model: embeddingModel,
        values: contentsToEmbed,
      });

      const embeddingData = emails.map((email, i) => ({
        userId,
        sourceType: 'email',
        sourceId: email.id,
        content: contentsToEmbed[i],
        embedding: embeddings[i],
      }));

      await batchInsertEmbeddings(embeddingData);
    } catch (error) {
      // decide how to handle embedding failure
      console.error('Failed to create embeddings', error);
      throw error;
    }
  }

  async searchEmails(
    userId: string,
    queryText: string,
    options: { limit?: number; similarityThreshold?: number } = {}
  ): Promise<SearchResult[]> {
    const { limit = 5, similarityThreshold = 0.4 } = options;

    try {
      const { embedding } = await embed({
        model: embeddingModel,
        value: queryText,
      });

      const results = await searchEmbeddings(
        userId,
        embedding,
        limit,
        0,
        'email'
      );

      return results.filter(r => r.similarity > similarityThreshold);
    } catch (error) {
      console.error('Failed to search embeddings', error);
      return [];
    }
  }
}
