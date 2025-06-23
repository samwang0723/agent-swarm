import { createOpenAI } from '@ai-sdk/openai';
import { batchInsertEmbeddings } from './embedding.repository';
import { embedMany } from 'ai';
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
}
