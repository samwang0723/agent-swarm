import { SSEStreamingApi } from 'hono/streaming';
import { OutputStrategy } from '@messages/types';
import logger from '@utils/logger';

export class HonoSSEOutput implements OutputStrategy {
  private stream: SSEStreamingApi;
  private sessionId: string;
  private isClosed = false;

  constructor(stream: SSEStreamingApi, sessionId: string) {
    this.stream = stream;
    this.sessionId = sessionId;
  }

  private safeWrite(event: string, data: object): void {
    if (this.isClosed) return;

    try {
      this.stream.writeSSE({ event, data: JSON.stringify(data) });
    } catch (error) {
      logger.error('Error writing to SSE stream:', {
        error,
        sessionId: this.sessionId,
      });
      this.isClosed = true;
    }
  }

  onStart(data: { sessionId: string; streaming: boolean }): void {
    this.safeWrite('start', data);
  }

  onChunk(text: string, accumulated: string): void {
    this.safeWrite('chunk', { text, accumulated });
  }

  onFinish(data: { complete: boolean; sessionId: string }): void {
    if (this.isClosed) return;

    this.safeWrite('finish', data);
    this.isClosed = true;
    try {
      this.stream.close();
    } catch (error) {
      logger.error('Error closing SSE stream:', {
        error,
        sessionId: this.sessionId,
      });
    }
  }

  onError(error: string): void {
    if (this.isClosed) return;

    this.safeWrite('error', { error });
    this.isClosed = true;
    try {
      this.stream.close();
    } catch (error) {
      logger.error('Error closing SSE stream after error:', {
        error,
        sessionId: this.sessionId,
      });
    }
  }
}

export class CollectOutput implements OutputStrategy {
  private fullText = '';

  onChunk(text: string, accumulated: string): void {
    this.fullText = accumulated;
  }

  getFullText(): string {
    return this.fullText;
  }
}
