import Serverless from 'serverless';
import monitorStackModule from 'serverless/lib/plugins/aws/lib/monitorStack';
import Aws from 'serverless/plugins/aws/provider/awsProvider';

export class ServerlessStackMonitor {

  constructor(
    private readonly serverless: Serverless,
    private readonly provider: Aws
  ) {}

  public async monitor(actionDescription: 'create' | 'update' | 'removal', stackId: string): Promise<void> {

    // monitorStack needs these variable on "this" reference it's called for
    const monitorStackContext = {
      serverless: this.serverless,
      provider: this.provider,
      options: { verbose: false }
    };

    // Here we're reusing internal implementation of serverless framework instead of doing our own
    // This should be more reliable in the long run.
    //
    // I've already tried CloudFormation.waitFor, that doesn't work because it stops as soon as the stack changes state
    // That means a stack that we started to delete may be in state DELETE_IN_PROGRESS, which waitFor treats as an error and stops
    return monitorStackModule.monitorStack.call(monitorStackContext, actionDescription, { StackId: stackId }, { frequency: 10000 });
  }
}
