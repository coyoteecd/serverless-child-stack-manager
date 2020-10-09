import Serverless from 'serverless';
import Plugin from 'serverless/classes/Plugin';

export interface AwsDeployPlugin extends Plugin {
  monitorStack(actionDescription: 'create' | 'update' | 'removal', { StackId: string }, options: { frequency?: number, verbose?: boolean }): Promise<string>;
}

export default class ServerlessStackMonitor {

  constructor(
    private readonly serverless: Serverless
  ) {}

  public async monitor(actionDescription: 'create' | 'update' | 'removal', stackId: string): Promise<string> {

    // Here we're reusing internal implementation of serverless framework instead of doing our own
    // This should be more reliable in the long run.
    //
    // I've already tried CloudFormation.waitFor, that doesn't work because it stops as soon as the stack changes state
    // That means a stack that we started to delete may be in state DELETE_IN_PROGRESS, which waitFor treats as an error and stops
    const awsDeployPlugin = this.serverless.pluginManager.plugins.find(p => ServerlessStackMonitor.isAwsDeployPlugin(p)) as AwsDeployPlugin;
    if (!awsDeployPlugin) {
      throw new Error('Cannot find AwsDeploy Serverless core plugin');
    }

    return awsDeployPlugin.monitorStack(actionDescription, { StackId: stackId }, { frequency: 10000 });
  }

  private static isAwsDeployPlugin(p: Plugin): p is AwsDeployPlugin {
    return (p as AwsDeployPlugin).monitorStack !== undefined;
  }
}
