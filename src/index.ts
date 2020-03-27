import { ServerlessStackMonitor } from './serverless-stack-monitor';

import Serverless = require('serverless');
import Plugin = require('serverless/classes/Plugin');
import Aws = require('serverless/plugins/aws/provider/awsProvider');
import CloudFormation = require('aws-sdk/clients/cloudformation');

class ServerlessStackSetManager implements Plugin {
  public hooks: Plugin.Hooks;
  private provider: Aws;
  private stackMonitor: ServerlessStackMonitor;

  constructor(private readonly serverless: Serverless) {
    this.hooks = {
      'before:remove:remove': async () => this.handleChildStacks('remove'),
      'after:deploy:deploy': async () => this.handleChildStacks('deploy')
    };
    this.provider = serverless.getProvider('aws');
    this.stackMonitor = new ServerlessStackMonitor(this.serverless, this.provider);
  }

  private async handleChildStacks(action: string): Promise<void> {
    const config = this.loadConfig();
    if (action === 'remove' && config.removalPolicy !== 'remove') {
      this.serverless.cli.log('Skipping remove of child stacks because of removalPolicy setting');
    } else {
      this.serverless.cli.log(`Handle stacks prefixed with: ${config.childStacksNamePrefix}. Action: ${action}`);

      const stackIds = await this.listMatchingStacks(config.childStacksNamePrefix);
      this.serverless.cli.log(`Found ${stackIds.length} stacks`);

      if (stackIds.length > 0) {
        this.serverless.cli.log('Starting operation');
        await this.handleStacks(stackIds, config.maxConcurrentCount, action);
      }

      this.serverless.cli.log('Operation successfully ended');
    }
  }

  private async listMatchingStacks(childStacksNamePrefix: string): Promise<string[]> {

    // Only look at the stacks which are in a "stable" state
    const params: CloudFormation.ListStacksInput = {
      StackStatusFilter: [
        'CREATE_COMPLETE',
        'ROLLBACK_COMPLETE',
        'UPDATE_COMPLETE',
        'IMPORT_COMPLETE'
      ]
    };
    const stackIds: string[] = [];

    while (true) {
      const result: CloudFormation.ListStacksOutput = await this.provider.request('CloudFormation', 'listStacks', params);
      if (result.StackSummaries) {
        const matchingStackIds = result.StackSummaries.filter(s => s.StackName.startsWith(childStacksNamePrefix))
          .filter(s => s.StackId)
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          .map(s => s.StackId!);
        stackIds.push(...matchingStackIds);
      }

      if (result.NextToken) {
        params.NextToken = result.NextToken;
      } else {
        // no more data, stop
        break;
      }
    }

    return stackIds;
  }

  private async handleStacks(stackIds: string[], maxConcurrentCount: number, action: string): Promise<void> {

    // We don't handle all stacks at once, because we risk being throttled by AWS
    //
    // This map tracks the stack IDs being deleted/deployed and the related promises.
    // Its size is capped to maxConcurrentCount value;
    // once an operation completes, we remove it from the map and add another
    // so as to maintain the same number of ongoing delete operations.
    const ongoingActions = new Map<string, Promise<string>>();

    // mutable queue of stack IDs to handle
    const queuedStackIds = Array.from(stackIds);

    // set up the initial batch
    queuedStackIds.splice(0, maxConcurrentCount).forEach(stackId => {
      ongoingActions.set(stackId, action === 'remove' ? this.deleteStack(stackId) : this.deployStack(stackId));
    });

    while (true) {
      const handledStackId = await Promise.race(ongoingActions.values());
      this.serverless.cli.log(`Stack ${handledStackId} successfully handled for ${action}`);

      // remove the completed promise and queue another delete operation to keep CloudFormation busy
      ongoingActions.delete(handledStackId);
      const nextStackId = queuedStackIds.pop();
      if (nextStackId) {
        ongoingActions.set(nextStackId, action === 'remove' ? this.deleteStack(nextStackId) : this.deployStack(nextStackId));
      }

      // see if there's more work to do
      if (ongoingActions.size === 0) {
        break;
      }
    }
  }

  private async deleteStack(stackId: string): Promise<string> {
    const deleteParams: CloudFormation.DeleteStackInput = {
      StackName: stackId
    };
    await this.provider.request('CloudFormation', 'deleteStack', deleteParams);

    return this.stackMonitor.monitor('removal', stackId).then(() => stackId);
  }

  private async deployStack(stackId: string): Promise<string> {
    this.serverless.cli.log(`Deploying stack with id: ${stackId}`);
    return stackId;
  }

  private loadConfig(): ServerlessChildStackManagerConfig {
    const providedConfig: Partial<ServerlessChildStackManagerConfig> = this.serverless.service.custom['serverless-child-stack-manager'];
    if (!providedConfig.childStacksNamePrefix) {
      throw new Error('childStacksNamePrefix is required');
    }

    return {
      childStacksNamePrefix: providedConfig.childStacksNamePrefix,
      removalPolicy: providedConfig.removalPolicy || 'keep',
      maxConcurrentCount: providedConfig.maxConcurrentCount || 5
    };
  }
}

module.exports = ServerlessStackSetManager;
