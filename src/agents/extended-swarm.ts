import {
  Agent,
  Hive,
  type HiveCreateSwarmOptions,
  Swarm,
  type SwarmOptions,
} from 'agentswarm';

export class ExtendedSwarm<
  SWARM_CONTEXT extends object,
> extends Swarm<SWARM_CONTEXT> {
  constructor(options: SwarmOptions<SWARM_CONTEXT>) {
    super(options);
  }

  public setActiveAgent(agent: Agent<SWARM_CONTEXT>): void {
    this._activeAgent = agent;
  }
}

export class ExtendedHive<
  HIVE_CONTEXT extends object,
> extends Hive<HIVE_CONTEXT> {
  public override spawnSwarm(
    options?: HiveCreateSwarmOptions<HIVE_CONTEXT>
  ): ExtendedSwarm<HIVE_CONTEXT> {
    if (!this.defaultInitialContext && !options?.defaultContext) {
      throw new Error(
        `Unable to create swarm from Hive: default context for swarm must be passed in Hive() or in Hive.swarm()`
      );
    }
    return new ExtendedSwarm<HIVE_CONTEXT>({
      defaultModel: options?.defaultModel || this['defaultModel'],
      queen: options?.queen || this.queen,
      initialContext: (options?.defaultContext || this.defaultInitialContext)!,
      messages: options?.messages,
    });
  }
}
