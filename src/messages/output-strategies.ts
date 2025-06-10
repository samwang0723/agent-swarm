import { Response } from 'express';
import { SSEOutputStrategy, OutputStrategy } from './types';

export class SSEOutput implements SSEOutputStrategy {
  response: Response;
  sessionId: string;

  constructor(response: Response, sessionId: string) {
    this.response = response;
    this.sessionId = sessionId;
  }

  onStart(data: { sessionId: string; streaming: boolean }): void {
    this.response.write(`event: start\ndata: ${JSON.stringify(data)}\n\n`);
  }

  onChunk(text: string, accumulated: string): void {
    this.response.write(
      `event: chunk\ndata: ${JSON.stringify({ text, accumulated })}\n\n`
    );
  }

  onFinish(data: { complete: boolean; sessionId: string }): void {
    this.response.write(`event: finish\ndata: ${JSON.stringify(data)}\n\n`);
    this.response.end();
  }

  onError(error: string): void {
    this.response.write(`event: error\ndata: ${JSON.stringify({ error })}\n\n`);
    this.response.end();
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
