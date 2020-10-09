import Serverless from 'serverless';
import PluginManager from 'serverless/classes/PluginManager';
import ServerlessStackMonitor from '../src/serverless-stack-monitor';

describe('ServerlessStackMonitor', () => {

  it('should create the StackMonitor', () => {
    const stackMonitor = new ServerlessStackMonitor({} as Serverless);
    expect(stackMonitor).toBeTruthy();
  });

  it('should initiate an AWS stack monitor when starting monitoring', async () => {
    const fakePlugin = jasmine.createSpyObj('AwsDeploy', ['monitorStack']);
    const serverless = {
      pluginManager: {
        plugins: [fakePlugin]
      } as unknown as PluginManager
    } as Serverless;
    const stackMonitor = new ServerlessStackMonitor(serverless);

    spyOn(serverless.pluginManager.plugins, 'find').and.callThrough();

    await expectAsync(stackMonitor.monitor('removal', 'stackId')).toBeResolved();
    expect(fakePlugin.monitorStack).toHaveBeenCalledWith(
      'removal',
      jasmine.objectContaining({ StackId: 'stackId' }),
      jasmine.anything()
    );
    expect(serverless.pluginManager.plugins.find).toHaveBeenCalled();
  });

  it('should throw an error when the AwsDeploy core plugin cannot be found', async () => {
    const serverless = {
      pluginManager: {
        plugins: []
      } as unknown as PluginManager
    } as Serverless;
    const stackMonitor = new ServerlessStackMonitor(serverless);

    spyOn(serverless.pluginManager.plugins, 'find').and.callThrough();

    await expectAsync(stackMonitor.monitor('removal', 'stackId')).toBeRejectedWithError('Cannot find AwsDeploy Serverless core plugin');
    expect(serverless.pluginManager.plugins.find).toHaveBeenCalled();
  });
});
