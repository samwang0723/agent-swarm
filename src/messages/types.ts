export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface OutputStrategy {
  onStart?: (data: { sessionId: string; streaming: boolean }) => void;
  onChunk: (text: string, accumulated: string) => void;
  onFinish?: (data: { complete: boolean; sessionId: string }) => void;
  onError?: (error: string) => void;
}

export interface ConsoleOutputStrategy extends OutputStrategy {
  onChunk: (text: string, accumulated: string) => void;
}

export interface SSEOutputStrategy extends OutputStrategy {
  response: any; // Express Response object
  sessionId: string;
}
