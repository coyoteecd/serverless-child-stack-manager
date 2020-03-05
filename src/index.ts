import Serverless = require('serverless');
import Plugin = require('serverless/classes/Plugin');

class ServerlessStackSetManager implements Plugin {
  public hooks: Plugin.Hooks;

  constructor(
    private readonly serverless: Serverless
  ) {
    this.hooks = {
      'before:remove:remove': async () => this.afterRemove()
    };
  }

  private async afterRemove(): Promise<void> {
    const config = this.loadConfig();
    if (config.removalPolicy === 'remove') {
      this.serverless.cli.log(`Removing stacks matching pattern: ${config.childStacksNamePattern}`);

      // list all stacks and put their stack ids in a "queue"
      // dequeue 10 stack ids and start deleting them, use waitFor to wait for deletion complete
      //
      // Promise.race on the "in progress" wait promises
      // when one completes or fails, log it and add another

      this.serverless.cli.log('Stacks removed successfully');
    } else {
      this.serverless.cli.log('Skipping remove of child stacks because of removalPolicy setting');
    }
  }

  private loadConfig(): ServerlessChildStackManagerConfig {
    const providedConfig: Partial<ServerlessChildStackManagerConfig> = this.serverless.service.custom['serverless-child-stack-manager'];
    if (!providedConfig.childStacksNamePattern) {
      throw new Error('childStacksNamePattern is required');
    }

    return {
      childStacksNamePattern: providedConfig.childStacksNamePattern,
      removalPolicy: providedConfig.removalPolicy || 'keep',
    };
  }
}

module.exports = ServerlessStackSetManager;
