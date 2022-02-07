import CloudFormation from 'aws-sdk/clients/cloudformation';
import Lambda from 'aws-sdk/clients/lambda';
import Serverless from 'serverless';
import Plugin from 'serverless/classes/Plugin';
import Aws from 'serverless/plugins/aws/provider/awsProvider';
import ServerlessStackMonitor from './serverless-stack-monitor';

type StackAction = (stackId: string) => Promise<string>;

export default class ServerlessChildStackManager implements Plugin {
  public hooks: Plugin.Hooks;
  private provider: Aws;
  private stackMonitor: ServerlessStackMonitor;

  constructor(private readonly serverless: Serverless) {
    this.hooks = {
      'before:remove:remove': async () => this.afterRemove(),
      'after:deploy:deploy': async () => this.afterDeploy()
    };
    this.provider = serverless.getProvider('aws');
    this.stackMonitor = new ServerlessStackMonitor(this.serverless);
  }

  private async afterRemove(): Promise<void> {
    const config = this.loadConfig();
    if (config.removalPolicy === 'remove') {
      this.serverless.cli.log(`Removing stacks prefixed with: ${config.childStacksNamePrefix}`);

      const stackIds = await this.listMatchingStacks(config.childStacksNamePrefix);
      this.serverless.cli.log(`Found ${stackIds.length} stacks`);

      if (stackIds.length > 0) {
        this.serverless.cli.log('Starting delete operation');

        const deleteAction: StackAction = stackId => this
          .deleteStack(stackId)
          .catch(err => this.handleStackActionError(err, stackId, config.continueOnFailure));
        await this.executeConcurrentStackActions(stackIds, config.maxConcurrentCount, deleteAction);
        this.serverless.cli.log('Stacks successfully removed');
      } else {
        this.serverless.cli.log('Skipping remove of child stacks because no stacks found');
      }

    } else {
      this.serverless.cli.log('Skipping remove of child stacks because of removalPolicy setting');
    }
  }

  private async afterDeploy(): Promise<void> {
    const config = this.loadConfig();
    this.serverless.cli.log(`Deploying stacks prefixed with: ${config.childStacksNamePrefix}`);

    const stackIds = await this.listMatchingStacks(config.childStacksNamePrefix);
    this.serverless.cli.log(`Found ${stackIds.length} stacks`);

    if (stackIds.length > 0) {
      this.serverless.cli.log('Starting update operation');
      const updateAction: StackAction = stackId => this
        .deployStack(stackId, config.upgradeFunction)
        .catch(err => this.handleStackActionError(err, stackId, config.continueOnFailure));
      await this.executeConcurrentStackActions(stackIds, config.maxConcurrentCount, updateAction);
      this.serverless.cli.log('Stacks successfully updated');
    } else {
      this.serverless.cli.log('Skipping update of child stacks because no stacks found');
    }
  }

  private handleStackActionError(error: Error, stackId: string, continueOnFailure: boolean): string {
    if (continueOnFailure) {
      this.serverless.cli.log(`Stack ${stackId} failed: ${error}`);
      this.serverless.cli.log(`Stack ${stackId} failure ignored because continueOnFailure=true`);
      return stackId;
    }

    throw error;
  }

  /**
   * Deletes or deploys the child stacks, parallelizing the stack action
   * so that no more than maxConcurrentCount stacks are changed simultaneously.
   */
  private async executeConcurrentStackActions(stackIds: string[], maxConcurrentCount: number, stackAction: StackAction): Promise<void> {

    // We don't delete/deploy everything at once, because we risk being throttled by AWS
    //
    // This map tracks the stack IDs being handled and the related promises.
    // Its size is capped to maxParallelDeletes value;
    // once an operation completes, we remove it from the map and add another
    // so as to maintain the same number of ongoing delete operations.
    const ongoingUpdates = new Map<string, Promise<string>>();

    // mutable queue of stack IDs to delete
    const queuedStackIds = Array.from(stackIds);

    // set up the initial batch
    queuedStackIds.splice(0, maxConcurrentCount).forEach(stackId => {
      ongoingUpdates.set(stackId, stackAction(stackId));
    });

    while (true) {
      const completedStackId = await Promise.race(ongoingUpdates.values());
      this.serverless.cli.log(`Stack ${completedStackId} operation completed.`);

      // remove the completed promise and queue another delete operation to keep CloudFormation busy
      ongoingUpdates.delete(completedStackId);
      const nextStackId = queuedStackIds.pop();
      if (nextStackId) {
        ongoingUpdates.set(nextStackId, stackAction(nextStackId));
      }

      // see if there's more work to do
      if (ongoingUpdates.size === 0) {
        break;
      }
    }
  }

  private async listMatchingStacks(childStacksNamePrefix: string): Promise<string[]> {

    // Only look at the stacks which are in a "stable" state
    const params: CloudFormation.ListStacksInput = {
      StackStatusFilter: [
        'CREATE_COMPLETE',
        'ROLLBACK_COMPLETE',
        'UPDATE_COMPLETE',
        'IMPORT_COMPLETE',
        'UPDATE_ROLLBACK_COMPLETE',
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

  private async deleteStack(stackId: string): Promise<string> {
    const deleteParams: CloudFormation.DeleteStackInput = {
      StackName: stackId
    };
    await this.provider.request('CloudFormation', 'deleteStack', deleteParams);

    return this.stackMonitor.monitor('removal', stackId).then(() => stackId);
  }

  private async deployStack(stackId: string, upgradeFunction: string): Promise<string> {
    this.serverless.cli.log(`Deploying stack with id: ${stackId}`);

    const params = {
      FunctionName: upgradeFunction,
      InvocationType: 'RequestResponse',
      LogType: 'None',
      Payload: JSON.stringify({ stackId }),
    };

    const response: Lambda.InvocationResponse = await this.provider.request('Lambda', 'invoke', params);
    if (response.FunctionError && response.Payload) {
      const errorDetail: { errorMessage: string } = JSON.parse(response.Payload.toString());
      throw new Error(errorDetail.errorMessage);
    }
    return this.stackMonitor.monitor('update', stackId).then(() => stackId);
  }

  private loadConfig(): ServerlessChildStackManagerConfig {
    const providedConfig: Partial<ServerlessChildStackManagerConfig> = this.serverless.service.custom['serverless-child-stack-manager'];
    if (!providedConfig.childStacksNamePrefix) {
      throw new Error('childStacksNamePrefix is required');
    }

    return {
      childStacksNamePrefix: providedConfig.childStacksNamePrefix,
      removalPolicy: providedConfig.removalPolicy || 'keep',
      maxConcurrentCount: providedConfig.maxConcurrentCount || 5,
      upgradeFunction: providedConfig.upgradeFunction || '',
      continueOnFailure: providedConfig.continueOnFailure || false
    };
  }
}

module.exports = ServerlessChildStackManager;
