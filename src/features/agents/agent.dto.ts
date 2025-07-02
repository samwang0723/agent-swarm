import {
  Agent,
  Hive,
  Swarm,
  type HiveCreateSwarmOptions,
  type SwarmOptions,
} from 'agentswarm';
import { LanguageModelV1 } from 'ai';
import { z, ZodObject } from 'zod';
import { AgentRegistry } from './agent.repository';

export const UBER_EATS_DOMAIN = 'https://www.ubereats.com';

export interface StoreInfo {
  name: string;
  url: string;
  deliveryTime: string;
}

export interface ChatContext {
  topic: string | null;
  accessToken?: string; // User's OAuth access token for MCP services
}

export const HandoverToolSchema = z.object({
  type: z.literal('handover'),
  description: z.string(),
  parameters: z.instanceof(ZodObject),
  execute: z.function(z.tuple([z.any()]), z.promise(z.any())),
});

export type HandoverTool = z.infer<typeof HandoverToolSchema>;

export class ExtendedSwarm<TContext extends object> extends Swarm<TContext> {
  public readonly hive: ExtendedHive<TContext>;

  constructor(
    options: SwarmOptions<TContext> & { hive: ExtendedHive<TContext> }
  ) {
    super(options);
    this.hive = options.hive;
  }

  public setActiveAgent(agent: Agent<TContext>): void {
    this._activeAgent = agent;
  }
}

export class ExtendedHive<TContext extends object> extends Hive<TContext> {
  public readonly registry: AgentRegistry;
  constructor(options: {
    queen: Agent<TContext>;
    defaultModel: LanguageModelV1;
    defaultContext: TContext;
    registry: AgentRegistry;
  }) {
    super(options);
    this.registry = options.registry;
  }

  public override spawnSwarm(
    options?: HiveCreateSwarmOptions<TContext>
  ): ExtendedSwarm<TContext> {
    const swarmOptions: SwarmOptions<TContext> = {
      defaultModel: options?.defaultModel || this['defaultModel'],
      queen: options?.queen || this.queen,
      initialContext: (options?.defaultContext || this.defaultInitialContext)!,
      messages: options?.messages,
    };
    return new ExtendedSwarm<TContext>({ ...swarmOptions, hive: this });
  }
}
