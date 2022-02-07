import CloudFormation from 'aws-sdk/clients/cloudformation';
import Lambda from 'aws-sdk/clients/lambda';
import Serverless, { Options } from 'serverless';
import { Logging } from 'serverless/classes/Plugin';
import Aws from 'serverless/plugins/aws/provider/awsProvider';
import ServerlessChildStackManager from '../src/index';
import ServerlessStackMonitor from '../src/serverless-stack-monitor';
import notMatching from './matchers/custom-matchers';

describe('ServerlessChildStackManager', () => {

  it('should create the plugin and set up configuration schema', () => {
    const { serverless } = stubServerlessInstance();

    const plugin = new ServerlessChildStackManager(serverless, {} as Options, stubLogging());
    expect(plugin).toBeTruthy();

    expect(serverless.configSchemaHandler.defineCustomProperties).toHaveBeenCalledWith({
      type: 'object',
      properties: {
        'serverless-child-stack-manager': jasmine.objectContaining({
          properties: jasmine.objectContaining({
            childStacksNamePrefix: jasmine.anything(),
            removalPolicy: jasmine.anything(),
            maxConcurrentCount: jasmine.anything(),
            upgradeFunction: jasmine.anything(),
            continueOnFailure: jasmine.anything(),
          })
        })
      }
    });
  });

  it('should delete all stacks with the specified prefixes', async () => {
    const prefixToDelete = 'FakePrefix';
    const fakeListOutput = {
      StackSummaries: [
        { StackId: 1, StackName: `${prefixToDelete}-FakeEntry1` },
        { StackId: 2, StackName: 'ShouldNotDelete-FakeEntry2' },
        { StackId: 3, StackName: `${prefixToDelete}-FakeEntry3` }
      ] as unknown as CloudFormation.StackSummary[]
    } as CloudFormation.ListStacksOutput;

    const logging = stubLogging();
    const { serverless, requestSpy } = stubServerlessInstance({
      childStacksNamePrefix: prefixToDelete,
      upgradeFunction: 'func',
      removalPolicy: 'remove',
      maxConcurrentCount: 1,
      continueOnFailure: false
    });
    requestSpy
      .withArgs(jasmine.any(String), 'listStacks', jasmine.anything()).and.resolveTo(fakeListOutput)
      .withArgs(jasmine.any(String), 'deleteStack', jasmine.anything()).and.resolveTo(undefined);

    const stackManager = new ServerlessChildStackManager(serverless, {} as Options, logging);
    const stackMonitorSpy = spyOn(ServerlessStackMonitor.prototype, 'monitor').and.resolveTo(undefined);

    // Invoke the actual remove function
    const removeFn = stackManager.hooks['before:remove:remove'];
    await expectAsync(removeFn()).toBeResolved();

    expect(requestSpy.calls.allArgs().filter(arg => arg[1] === 'deleteStack')).withContext('Should have invoked 2 deletes').toHaveSize(2);
    expect(stackMonitorSpy.calls.allArgs().filter(arg => arg[0] === 'removal')).withContext('Should have started 2 monitors').toHaveSize(2);
    expect(logging.log.success).toHaveBeenCalledWith('Stacks successfully removed');
  });

  it('should deploy all stacks with the specified prefixes', async () => {
    const prefixToDeploy = 'FakePrefix';
    const fakeListOutput = {
      StackSummaries: [
        { StackId: 1, StackName: `${prefixToDeploy}-FakeEntry1` },
        { StackId: 2, StackName: 'ShouldNotDeploy-FakeEntry2' },
        { StackId: 3, StackName: `${prefixToDeploy}-FakeEntry3` }
      ] as unknown as CloudFormation.StackSummary[]
    } as CloudFormation.ListStacksOutput;

    const logging = stubLogging();
    const { serverless, requestSpy } = stubServerlessInstance({
      childStacksNamePrefix: prefixToDeploy,
      upgradeFunction: 'func',
      removalPolicy: 'remove',
      maxConcurrentCount: 1,
      continueOnFailure: false
    });
    requestSpy
      .withArgs(jasmine.any(String), 'listStacks', jasmine.anything()).and.resolveTo(fakeListOutput)
      .withArgs(jasmine.any(String), 'invoke', jasmine.anything()).and.resolveTo({});

    const stackManager = new ServerlessChildStackManager(serverless, {} as Options, logging);
    const stackMonitorSpy = spyOn(ServerlessStackMonitor.prototype, 'monitor').and.resolveTo(undefined);

    // Invoke the actual deploy function
    const deployFn = stackManager.hooks['after:deploy:deploy'];
    await expectAsync(deployFn()).toBeResolved();

    expect(requestSpy.calls.allArgs().filter(arg => arg[1] === 'invoke')).withContext('Should have invoked 2 invokes').toHaveSize(2);
    expect(stackMonitorSpy.calls.allArgs().filter(arg => arg[0] === 'update')).withContext('Should have started 2 monitors').toHaveSize(2);
    expect(logging.log.success).toHaveBeenCalledWith('Stacks successfully updated');
  });

  it('should read all paged listings and delete all stacks with the specified prefix', async () => {
    const prefixToDelete = 'FakePrefix';
    const fakeListOutput1 = {
      NextToken: '1',
      StackSummaries: [
        { StackId: 1, StackName: `${prefixToDelete}-FakeEntry1` },
        { StackId: 2, StackName: `${prefixToDelete}-FakeEntry2` }
      ] as unknown as CloudFormation.StackSummary[]
    } as CloudFormation.ListStacksOutput;
    const fakeListOutput2 = {
      NextToken: '2',
      StackSummaries: [
        { StackId: 3, StackName: `${prefixToDelete}-FakeEntry3` },
        { StackId: 4, StackName: `${prefixToDelete}-FakeEntry4` }
      ] as unknown as CloudFormation.StackSummary[]
    } as CloudFormation.ListStacksOutput;
    const fakeListOutput3 = {
      StackSummaries: [
        { StackId: 5, StackName: `${prefixToDelete}-FakeEntry5` }
      ] as unknown as CloudFormation.StackSummary[]
    } as CloudFormation.ListStacksOutput;

    const logging = stubLogging();
    const { serverless, requestSpy } = stubServerlessInstance({
      childStacksNamePrefix: prefixToDelete,
      upgradeFunction: 'func',
      removalPolicy: 'remove',
      maxConcurrentCount: 2,
      continueOnFailure: false
    });
    requestSpy
      .withArgs(jasmine.any(String), 'listStacks', notMatching(jasmine.objectContaining({ NextToken: jasmine.any(String) }))).and.resolveTo(fakeListOutput1)
      .withArgs(jasmine.any(String), 'listStacks', jasmine.objectContaining({ NextToken: '1' })).and.resolveTo(fakeListOutput2)
      .withArgs(jasmine.any(String), 'listStacks', jasmine.objectContaining({ NextToken: '2' })).and.resolveTo(fakeListOutput3)
      .withArgs(jasmine.any(String), 'deleteStack', jasmine.anything()).and.resolveTo(undefined);

    const stackManager = new ServerlessChildStackManager(serverless, {} as Options, logging);
    const stackMonitorSpy = spyOn(ServerlessStackMonitor.prototype, 'monitor').and.resolveTo(undefined);

    // Invoke the actual remove function
    const removeFn = stackManager.hooks['before:remove:remove'];
    await expectAsync(removeFn()).toBeResolved();

    expect(requestSpy.calls.allArgs().filter(arg => arg[1] === 'deleteStack')).withContext('Should have invoked 5 deletes').toHaveSize(5);
    expect(stackMonitorSpy.calls.allArgs().filter(arg => arg[0] === 'removal')).withContext('Should have started 5 monitors').toHaveSize(5);
    expect(logging.log.success).toHaveBeenCalledWith('Stacks successfully removed');
  });

  it('should not delete if the stack listing yields empty response', async () => {
    const logging = stubLogging();
    const { serverless, requestSpy } = stubServerlessInstance({
      childStacksNamePrefix: 'DontCare',
      upgradeFunction: 'func',
      removalPolicy: 'remove'
    });
    requestSpy.withArgs(jasmine.any(String), 'listStacks', jasmine.anything()).and.resolveTo({});

    const stackManager = new ServerlessChildStackManager(serverless, {} as Options, logging);
    const removeFn = stackManager.hooks['before:remove:remove'];

    // Invoke the actual remove function
    await expectAsync(removeFn()).toBeResolved();

    expect(logging.log.success).toHaveBeenCalledWith('Skipping remove of child stacks because no stacks found');
    expect(requestSpy).not.toHaveBeenCalledWith(jasmine.anything(), 'deleteStack', jasmine.anything());
  });

  it('should not delete if the stack listing yields no stacks', async () => {
    const fakeListOutput = {
      StackSummaries: []
    } as CloudFormation.ListStacksOutput;

    const logging = stubLogging();
    const { serverless, requestSpy } = stubServerlessInstance({
      childStacksNamePrefix: 'DontCare',
      upgradeFunction: 'func',
      removalPolicy: 'remove'
    });
    requestSpy.withArgs(jasmine.any(String), 'listStacks', jasmine.anything()).and.resolveTo(fakeListOutput);

    const stackManager = new ServerlessChildStackManager(serverless, {} as Options, logging);
    const removeFn = stackManager.hooks['before:remove:remove'];

    // Invoke the actual remove function
    await expectAsync(removeFn()).toBeResolved();

    expect(logging.log.success).toHaveBeenCalledWith('Skipping remove of child stacks because no stacks found');
    expect(requestSpy).not.toHaveBeenCalledWith(jasmine.anything(), 'deleteStack', jasmine.anything());
  });

  it('should skip delete when the removalPolicy is set to default (keep)', async () => {
    const prefixToDeploy = 'FakePrefix';
    const fakeListOutput = {
      StackSummaries: [
        { StackId: 1, StackName: `${prefixToDeploy}-FakeEntry1` },
      ] as unknown as CloudFormation.StackSummaries
    } as CloudFormation.ListStacksOutput;

    const logging = stubLogging();
    const { serverless, requestSpy } = stubServerlessInstance({
      childStacksNamePrefix: prefixToDeploy,
      upgradeFunction: 'func',
    });
    requestSpy.withArgs(jasmine.any(String), 'listStacks', jasmine.anything()).and.resolveTo(fakeListOutput);

    const stackManager = new ServerlessChildStackManager(serverless, {} as Options, logging);
    const removeFn = stackManager.hooks['before:remove:remove'];

    // Invoke the actual remove function
    await expectAsync(removeFn()).toBeResolved();
    expect(logging.log.verbose).toHaveBeenCalledWith(jasmine.stringMatching(/^Skipping remove.*removalPolicy/));
    expect(requestSpy).not.toHaveBeenCalledWith(jasmine.anything(), 'deleteStack', jasmine.anything());
  });

  it('should not deploy if the stack listing yields no result', async () => {
    const fakeListOutput = {
      StackSummaries: []
    } as CloudFormation.ListStacksOutput;

    const logging = stubLogging();
    const { serverless, requestSpy } = stubServerlessInstance({
      childStacksNamePrefix: 'DontCare',
      upgradeFunction: 'func',
      removalPolicy: 'remove',
      continueOnFailure: false
    });
    requestSpy.withArgs(jasmine.any(String), 'listStacks', jasmine.anything()).and.resolveTo(fakeListOutput);

    const stackManager = new ServerlessChildStackManager(serverless, {} as Options, logging);
    const deployFn = stackManager.hooks['after:deploy:deploy'];

    // Invoke the actual remove function
    await expectAsync(deployFn()).toBeResolved();

    expect(logging.log.success).toHaveBeenCalledWith('Skipping update of child stacks because no stacks found');
    expect(requestSpy).not.toHaveBeenCalledWith(jasmine.anything(), 'invoke', jasmine.anything());
  });

  it('should throw when the stack prefix is omitted', async () => {
    const { serverless } = stubServerlessInstance({
      childStacksNamePrefix: undefined
    });

    const stackManager = new ServerlessChildStackManager(serverless, {} as Options, stubLogging());
    const removeFn = stackManager.hooks['before:remove:remove'];

    // Invoke the actual remove function
    await expectAsync(removeFn()).toBeRejectedWithError(/childStacksNamePrefix is required/);
  });

  it('should throw when the stack upgrade function is omitted', async () => {
    const { serverless } = stubServerlessInstance({
      childStacksNamePrefix: 'defined',
      upgradeFunction: undefined
    });

    const stackManager = new ServerlessChildStackManager(serverless, {} as Options, stubLogging());
    const removeFn = stackManager.hooks['before:remove:remove'];

    // Invoke the actual remove function
    await expectAsync(removeFn()).toBeRejectedWithError(/upgradeFunction is required/);
  });

  it('should stop deploying other stacks when a stack fails and continueOnFailure is false', async () => {
    const prefixToDeploy = 'FakePrefix';
    const fakeListOutput = {
      StackSummaries: [
        { StackId: 1, StackName: `${prefixToDeploy}-FakeEntry1` },
        { StackId: 2, StackName: `${prefixToDeploy}-FakeEntry2` },
        { StackId: 3, StackName: `${prefixToDeploy}-FakeEntry3` }
      ] as unknown as CloudFormation.StackSummary[]
    } as CloudFormation.ListStacksOutput;

    const { serverless, requestSpy } = stubServerlessInstance({
      childStacksNamePrefix: prefixToDeploy,
      upgradeFunction: 'func',
      removalPolicy: 'remove',
      maxConcurrentCount: 1,
      continueOnFailure: false
    });
    requestSpy
      .withArgs(jasmine.any(String), 'listStacks', jasmine.anything()).and.resolveTo(fakeListOutput)
      .withArgs(jasmine.any(String), 'invoke', jasmine.anything()).and.resolveTo({});

    const stackManager = new ServerlessChildStackManager(serverless, {} as Options, stubLogging());
    const errorMessage = 'terrible error';
    const stackMonitorSpy = spyOn(ServerlessStackMonitor.prototype, 'monitor').and.rejectWith(new Error(errorMessage));

    // Invoke the actual deploy function
    const deployFn = stackManager.hooks['after:deploy:deploy'];
    await expectAsync(deployFn()).toBeRejectedWithError(errorMessage);

    expect(requestSpy.calls.allArgs().filter(arg => arg[1] === 'invoke')).withContext('Should have invoked only 1 invoke').toHaveSize(1);
    expect(stackMonitorSpy.calls.allArgs().filter(arg => arg[0] === 'update')).withContext('Should have started only 1 monitor').toHaveSize(1);
  });

  it('should fail deployment when invoking the upgradeFunction returns an error and continueOnFailure is false', async () => {
    const prefixToDeploy = 'FakePrefix';
    const fakeListOutput = {
      StackSummaries: [
        { StackId: 1, StackName: `${prefixToDeploy}-FakeEntry1` },
        { StackId: 2, StackName: `${prefixToDeploy}-FakeEntry2` },
      ] as unknown as CloudFormation.StackSummary[]
    } as CloudFormation.ListStacksOutput;

    const errorMessage = 'Internal error';
    const errorResponse: Lambda.InvocationResponse = {
      StatusCode: 200,
      FunctionError: 'Crashed',
      Payload: JSON.stringify({ errorMessage })
    };

    const { serverless, requestSpy } = stubServerlessInstance({
      childStacksNamePrefix: prefixToDeploy,
      upgradeFunction: 'func',
      removalPolicy: 'remove',
      maxConcurrentCount: 1,
      continueOnFailure: false
    });
    requestSpy
      .withArgs(jasmine.any(String), 'listStacks', jasmine.anything()).and.resolveTo(fakeListOutput)
      .withArgs(jasmine.any(String), 'invoke', jasmine.anything()).and.resolveTo(errorResponse);

    const stackManager = new ServerlessChildStackManager(serverless, {} as Options, stubLogging());
    const stackMonitorSpy = spyOn(ServerlessStackMonitor.prototype, 'monitor').and.resolveTo(undefined);

    // Invoke the actual deploy function
    const deployFn = stackManager.hooks['after:deploy:deploy'];
    await expectAsync(deployFn()).toBeRejectedWithError('Internal error');

    expect(requestSpy.calls.allArgs().filter(arg => arg[1] === 'invoke')).withContext('Should have invoked only 1 invoke').toHaveSize(1);
    expect(stackMonitorSpy.calls.allArgs().filter(arg => arg[0] === 'update')).withContext('Should not have started monitoring').toHaveSize(0);
  });

  it('should continue deploying other stacks when a stack fails and continueOnFailure is true', async () => {
    const prefixToDeploy = 'FakePrefix';
    const fakeListOutput = {
      StackSummaries: [
        { StackId: 1, StackName: `${prefixToDeploy}-FakeEntry1` },
        { StackId: 2, StackName: `${prefixToDeploy}-FakeEntry2` },
        { StackId: 3, StackName: `${prefixToDeploy}-FakeEntry3` }
      ] as unknown as CloudFormation.StackSummary[]
    } as CloudFormation.ListStacksOutput;

    const logging = stubLogging();
    const { serverless, requestSpy } = stubServerlessInstance({
      childStacksNamePrefix: prefixToDeploy,
      upgradeFunction: 'func',
      removalPolicy: 'remove',
      maxConcurrentCount: 1,
      continueOnFailure: true
    });
    requestSpy
      .withArgs(jasmine.any(String), 'listStacks', jasmine.anything()).and.resolveTo(fakeListOutput)
      .withArgs(jasmine.any(String), 'invoke', jasmine.anything()).and.resolveTo({});

    const stackManager = new ServerlessChildStackManager(serverless, {} as Options, logging);
    const stackMonitorSpy = spyOn(ServerlessStackMonitor.prototype, 'monitor').and.rejectWith('terrible error');

    // Invoke the actual deploy function
    const deployFn = stackManager.hooks['after:deploy:deploy'];
    await expectAsync(deployFn()).toBeResolved();

    expect(requestSpy.calls.allArgs().filter(arg => arg[1] === 'invoke')).withContext('Should have deleted all 3 stacks').toHaveSize(3);
    expect(stackMonitorSpy.calls.allArgs().filter(arg => arg[0] === 'update')).withContext('Should have started all 3 monitors').toHaveSize(3);
    expect(logging.log.success).toHaveBeenCalledWith('Stacks successfully updated');
  });

  it('should stop removing other stacks when a stack fails and continueOnFailure is false', async () => {
    const prefixToDeploy = 'FakePrefix';
    const fakeListOutput = {
      StackSummaries: [
        { StackId: 1, StackName: `${prefixToDeploy}-FakeEntry1` },
        { StackId: 2, StackName: `${prefixToDeploy}-FakeEntry2` },
        { StackId: 3, StackName: `${prefixToDeploy}-FakeEntry3` }
      ] as unknown as CloudFormation.StackSummary[]
    } as CloudFormation.ListStacksOutput;

    const { serverless, requestSpy } = stubServerlessInstance({
      childStacksNamePrefix: prefixToDeploy,
      upgradeFunction: 'func',
      removalPolicy: 'remove',
      maxConcurrentCount: 1,
      continueOnFailure: false
    });
    requestSpy
      .withArgs(jasmine.any(String), 'listStacks', jasmine.anything()).and.resolveTo(fakeListOutput)
      .withArgs(jasmine.any(String), 'invoke', jasmine.anything()).and.resolveTo({});

    const stackManager = new ServerlessChildStackManager(serverless, {} as Options, stubLogging());
    const errorMessage = 'terrible error';
    const stackMonitorSpy = spyOn(ServerlessStackMonitor.prototype, 'monitor').and.rejectWith(new Error(errorMessage));

    // Invoke the actual deploy function
    const deployFn = stackManager.hooks['after:deploy:deploy'];
    await expectAsync(deployFn()).toBeRejectedWithError(errorMessage);

    expect(requestSpy.calls.allArgs().filter(arg => arg[1] === 'invoke')).withContext('Should have invoked only 1 invoke').toHaveSize(1);
    expect(stackMonitorSpy.calls.allArgs().filter(arg => arg[0] === 'update')).withContext('Should have started only 1 monitor').toHaveSize(1);
  });

  it('should continue removing other stacks when a stack fails and continueOnFailure is true', async () => {
    const prefixToDeploy = 'FakePrefix';
    const fakeListOutput = {
      StackSummaries: [
        { StackId: 1, StackName: `${prefixToDeploy}-FakeEntry1` },
        { StackId: 2, StackName: `${prefixToDeploy}-FakeEntry2` },
        { StackId: 3, StackName: `${prefixToDeploy}-FakeEntry3` }
      ] as unknown as CloudFormation.StackSummary[]
    } as CloudFormation.ListStacksOutput;

    const logging = stubLogging();
    const { serverless, requestSpy } = stubServerlessInstance({
      childStacksNamePrefix: prefixToDeploy,
      upgradeFunction: 'func',
      removalPolicy: 'remove',
      maxConcurrentCount: 1,
      continueOnFailure: true
    });
    requestSpy
      .withArgs(jasmine.any(String), 'listStacks', jasmine.anything()).and.resolveTo(fakeListOutput)
      .withArgs(jasmine.any(String), 'deleteStack', jasmine.anything()).and.resolveTo(undefined);

    const stackManager = new ServerlessChildStackManager(serverless, {} as Options, logging);
    const stackMonitorSpy = spyOn(ServerlessStackMonitor.prototype, 'monitor').and.rejectWith('terrible error');

    // Invoke the actual deploy function
    const removeFn = stackManager.hooks['before:remove:remove'];
    await expectAsync(removeFn()).toBeResolved();

    expect(requestSpy.calls.allArgs().filter(arg => arg[1] === 'deleteStack')).withContext('Should have deleted all 3 stacks').toHaveSize(3);
    expect(stackMonitorSpy.calls.allArgs().filter(arg => arg[0] === 'removal')).withContext('Should have started all 3 monitors').toHaveSize(3);
    expect(logging.log.success).toHaveBeenCalledWith('Stacks successfully removed');
  });

  function stubServerlessInstance(config?: Partial<ServerlessChildStackManagerConfig>): { requestSpy: jasmine.Spy; serverless: jasmine.SpyObj<Serverless> } {
    const requestSpy = jasmine.createSpy('request').and.resolveTo({});
    return {
      requestSpy,
      serverless: jasmine.createSpyObj<Serverless>({
        getProvider: ({
          request: requestSpy
        }) as unknown as Aws,
      }, {
        cli: jasmine.createSpyObj(['log']),
        service: jasmine.createSpyObj([], {
          custom: {
            'serverless-child-stack-manager': config
          }
        }),
        configSchemaHandler: jasmine.createSpyObj(['defineCustomProperties']),
      })
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function stubLogging(): { writeText, log: jasmine.SpyObj<Logging['log']>, progress: jasmine.SpyObj<any> } {
    const progressInstance = jasmine.createSpyObj(['update', 'remove']);
    return {
      writeText: undefined,
      log: jasmine.createSpyObj<Logging['log']>([
        'error', 'warning', 'success', 'notice', 'verbose'
      ]),
      progress: jasmine.createSpyObj({
        create: progressInstance,
        get: progressInstance
      }),
    };
  }
});
