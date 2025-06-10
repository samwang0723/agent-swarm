import { Response } from 'express';
import {
  ConsoleOutputStrategy,
  SSEOutputStrategy,
  OutputStrategy,
} from './types';

export class ConsoleOutput implements ConsoleOutputStrategy {
  private isFirstChunk = true;

  onStart?(data: { sessionId: string; streaming: boolean }): void {
    // Console doesn't need start events
  }

  onChunk(text: string, accumulated: string): void {
    // Handle the first chunk to ensure proper spacing
    if (this.isFirstChunk) {
      process.stdout.write(' '); // Add a space after "Claude:"
      this.isFirstChunk = false;
    }

    // Write the text chunk, preserving any natural line breaks in the content
    process.stdout.write(text);
  }

  onFinish?(data: { complete: boolean; sessionId: string }): void {
    // Add a final newline after the complete response
    process.stdout.write('\n');
  }

  onError?(error: string): void {
    // Console errors are already handled by logger
  }
}

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
