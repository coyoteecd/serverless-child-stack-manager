import Serverless from 'serverless';
import monitorStackModule from 'serverless/lib/plugins/aws/lib/monitorStack';
import Aws from 'serverless/plugins/aws/provider/awsProvider';
import { ServerlessStackMonitor } from '../src/serverless-stack-monitor';

describe('ServerlessStackMonitor', () => {

  it('should create the StackMonitor', () => {
    const stackMonitor = new ServerlessStackMonitor({} as Serverless, {} as Aws);
    expect(stackMonitor).toBeTruthy();
  });

  it('should initiate an AWS stack monitor when starting monitoring', async () => {
    spyOn(monitorStackModule.monitorStack, 'call').and.resolveTo(undefined);

    const serverless = {} as Serverless;
    const provider = {} as Aws;
    const stackMonitor = new ServerlessStackMonitor(serverless, provider);

    await expectAsync(stackMonitor.monitor('removal', 'stackId')).toBeResolved();
    expect(monitorStackModule.monitorStack.call).toHaveBeenCalledWith(
      jasmine.objectContaining({ serverless, provider }),
      'removal',
      jasmine.objectContaining({ StackId: 'stackId' }),
      jasmine.anything()
    );
  });
});
