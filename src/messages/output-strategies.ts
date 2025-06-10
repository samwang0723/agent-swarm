import { Response } from 'express';
import { SSEOutputStrategy, OutputStrategy } from '@messages/types';

export class SSEOutput implements SSEOutputStrategy {
  response: Response;
  sessionId: string;
  private isEnded: boolean = false;

  constructor(response: Response, sessionId: string) {
    this.response = response;
    this.sessionId = sessionId;
  }

  private safeWrite(data: string): void {
    if (!this.isEnded && !this.response.destroyed && this.response.writable) {
      try {
        this.response.write(data);
      } catch (error) {
        console.error('Error writing to SSE stream:', error);
        this.isEnded = true;
      }
    }
  }

  onStart(data: { sessionId: string; streaming: boolean }): void {
    this.safeWrite(`event: start\ndata: ${JSON.stringify(data)}\n\n`);
  }

  onChunk(text: string, accumulated: string): void {
    this.safeWrite(
      `event: chunk\ndata: ${JSON.stringify({ text, accumulated })}\n\n`
    );
  }

  onFinish(data: { complete: boolean; sessionId: string }): void {
    if (!this.isEnded) {
      this.safeWrite(`event: finish\ndata: ${JSON.stringify(data)}\n\n`);
      this.isEnded = true;
      try {
        this.response.end();
      } catch (error) {
        console.error('Error ending SSE stream:', error);
      }
    }
  }

  onError(error: string): void {
    if (!this.isEnded) {
      this.safeWrite(`event: error\ndata: ${JSON.stringify({ error })}\n\n`);
      this.isEnded = true;
      try {
        this.response.end();
      } catch (error) {
        console.error('Error ending SSE stream after error:', error);
      }
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
