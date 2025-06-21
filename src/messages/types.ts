import { CoreMessage } from 'ai';

export type Message = CoreMessage;

export interface OutputStrategy {
  onStart?: (data: { sessionId: string; streaming: boolean }) => void;
  onChunk: (text: string, accumulated: string) => void;
  onFinish?: (data: { complete: boolean; sessionId: string }) => void;
  onError?: (error: string) => void;
}
