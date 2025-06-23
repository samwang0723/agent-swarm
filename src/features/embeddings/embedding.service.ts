// import { createOpenAI } from '@ai-sdk/openai';
import {
  batchInsertEmbeddings,
  searchEmbeddings,
  SearchResult,
} from './embedding.repository';
import { embed, embedMany } from 'ai';
import { EmailForEmbedding, CalendarEventForEmbedding } from './embedding.dto';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Initialize the OpenAI client for embeddings
// const openai = createOpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

// Specify the embedding model, e.g., 'text-embedding-3-small'
// const embeddingModel = openai.embedding('text-embedding-3-small');

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});
const embeddingModel = google.textEmbeddingModel('gemini-embedding-exp-03-07', {
  outputDimensionality: 1536, // optional, number of dimensions for the embedding
  taskType: 'SEMANTIC_SIMILARITY', // optional, specifies the task type for generating embeddings
});

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

  async createEmbeddingsForCalendarEvents(
    userId: string,
    events: CalendarEventForEmbedding[]
  ) {
    if (events.length === 0) {
      return;
    }

    const contentsToEmbed = events.map(event => {
      const start = event.startTime.toISOString();
      const end = event.endTime.toISOString();
      return `${event.title || ''} (from ${start} to ${end}) ${
        event.description || ''
      } ${event.location || ''}`;
    });

    try {
      const { embeddings } = await embedMany({
        model: embeddingModel,
        values: contentsToEmbed,
      });

      const embeddingData = events.map((event, i) => ({
        userId,
        sourceType: 'calendar_event',
        sourceId: event.id,
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
    const { limit = 5, similarityThreshold = 0.6 } = options;

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

  async searchCalendarEvents(
    userId: string,
    queryText: string,
    options: { limit?: number; similarityThreshold?: number } = {}
  ): Promise<SearchResult[]> {
    const { limit = 5, similarityThreshold = 0.6 } = options;

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
        'calendar_event'
      );

      return results.filter(r => r.similarity > similarityThreshold);
    } catch (error) {
      console.error('Failed to search embeddings', error);
      return [];
    }
  }
}
