import { ServerlessStackMonitor } from 'src/serverless-stack-monitor';
import notMatching from './matchers/custom-matchers';

import CloudFormation = require('aws-sdk/clients/cloudformation');
import Aws = require('serverless/plugins/aws/provider/awsProvider');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ServerlessStackSetManager = require('../src/index');

describe('ServerlessStackSetManager', () => {

  it('should create the Stack Set Manager', () => {
    const serverless = jasmine.createSpyObj(['getProvider']);

    const stackManager = new ServerlessStackSetManager(serverless);
    expect(stackManager).toBeTruthy();
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

    const provRequestSpy = jasmine.createSpy()
      .withArgs(jasmine.any(String), 'listStacks', jasmine.anything()).and.resolveTo(fakeListOutput)
      .withArgs(jasmine.any(String), 'deleteStack', jasmine.anything()).and.resolveTo(undefined);

    const cliLogSpy = jasmine.createSpy();

    // Create serverless spy object
    const serverless = jasmine.createSpyObj({
      // Serverless methods
      getProvider: ({ request: provRequestSpy } as unknown as Aws)
    }, {
      // Serverless properties
      cli: ({ log: cliLogSpy }),
      service: jasmine.createSpyObj([], {
        custom: {
          'serverless-child-stack-manager': {
            childStacksNamePrefix: prefixToDelete,
            removalPolicy: 'remove',
            maxConcurrentCount: 1
          } as Partial<ServerlessChildStackManagerConfig>
        }
      })
    });

    const stackManager = new ServerlessStackSetManager(serverless);
    const stackMonitor = stackManager.stackMonitor as ServerlessStackMonitor;

    const stackMonitorSpy = spyOn(stackMonitor, 'monitor').and.resolveTo(undefined);

    // Invoke the actual remove function
    const removeFn = stackManager.hooks['before:remove:remove'];
    await expectAsync(removeFn()).toBeResolved();

    expect(provRequestSpy.calls.allArgs().filter(arg => arg[1] === 'deleteStack').length).toBe(2, 'Should have invoked 2 deletes');
    expect(stackMonitorSpy.calls.allArgs().filter(arg => arg[0] === 'removal').length).toBe(2, 'Should have started 2 monitors');
    expect(cliLogSpy.calls.mostRecent().args[0]).toBe('Stacks removed successfully');
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

    const provRequestSpy = jasmine.createSpy()
      .withArgs(jasmine.any(String), 'listStacks', notMatching(jasmine.objectContaining({ NextToken: jasmine.any(String) }))).and.resolveTo(fakeListOutput1)
      .withArgs(jasmine.any(String), 'listStacks', jasmine.objectContaining({ NextToken: '1' })).and.resolveTo(fakeListOutput2)
      .withArgs(jasmine.any(String), 'listStacks', jasmine.objectContaining({ NextToken: '2' })).and.resolveTo(fakeListOutput3)
      .withArgs(jasmine.any(String), 'deleteStack', jasmine.anything()).and.resolveTo(undefined);

    const cliLogSpy = jasmine.createSpy();

    // Create serverless spy object
    const serverless = jasmine.createSpyObj({
      // Serverless methods
      getProvider: ({ request: provRequestSpy } as unknown as Aws)
    }, {
      // Serverless properties
      cli: ({ log: cliLogSpy }),
      service: jasmine.createSpyObj([], {
        custom: {
          'serverless-child-stack-manager': {
            childStacksNamePrefix: prefixToDelete,
            removalPolicy: 'remove',
            maxConcurrentCount: 2
          } as Partial<ServerlessChildStackManagerConfig>
        }
      })
    });

    const stackManager = new ServerlessStackSetManager(serverless);
    const stackMonitor = stackManager.stackMonitor as ServerlessStackMonitor;

    const stackMonitorSpy = spyOn(stackMonitor, 'monitor').and.resolveTo(undefined);

    // Invoke the actual remove function
    const removeFn = stackManager.hooks['before:remove:remove'];
    await expectAsync(removeFn()).toBeResolved();

    expect(provRequestSpy.calls.allArgs().filter(arg => arg[1] === 'deleteStack').length).toBe(5, 'Should have invoked 5 deletes');
    expect(stackMonitorSpy.calls.allArgs().filter(arg => arg[0] === 'removal').length).toBe(5, 'Should have started 5 monitors');
    expect(cliLogSpy.calls.mostRecent().args[0]).toBe('Stacks removed successfully');
  });

  it('should do nothing if the stack listing yields no result', async () => {
    const cliLogSpy = jasmine.createSpy();

    // Create serverless spy object
    const serverless = jasmine.createSpyObj({
      // Serverless methods
      getProvider: ({ request: jasmine.createSpy().and.resolveTo({}) } as unknown as Aws)
    }, {
      // Serverless properties
      cli: ({ log: cliLogSpy }),
      service: jasmine.createSpyObj([], {
        custom: {
          'serverless-child-stack-manager': {
            childStacksNamePrefix: 'DontCare',
            removalPolicy: 'remove'
          } as Partial<ServerlessChildStackManagerConfig>
        }
      })
    });

    const stackManager = new ServerlessStackSetManager(serverless);
    const removeFn = stackManager.hooks['before:remove:remove'];

    // Invoke the actual remove function
    await expectAsync(removeFn()).toBeResolved();

    expect(cliLogSpy.calls.mostRecent().args[0]).toBe('Stacks removed successfully');
  });

  it('should skip when the removalPolicy is set to keep', async () => {
    const cliLogSpy = jasmine.createSpy();

    // Create serverless spy object
    const serverless = jasmine.createSpyObj(['getProvider'], {
      // Serverless properties
      cli: ({ log: cliLogSpy }),
      service: jasmine.createSpyObj([], {
        custom: {
          'serverless-child-stack-manager': {
            childStacksNamePrefix: 'dontcare'
          } as Partial<ServerlessChildStackManagerConfig>
        }
      })
    });

    const stackManager = new ServerlessStackSetManager(serverless);
    const removeFn = stackManager.hooks['before:remove:remove'];

    // Invoke the actual remove function
    await expectAsync(removeFn()).toBeResolved();
    expect(cliLogSpy.calls.mostRecent().args[0]).toEqual(jasmine.stringMatching(/^Skipping remove.*removalPolicy/));
  });

  it('should throw when the stack prefix is omitted', async () => {
    // Create serverless spy object
    const serverless = jasmine.createSpyObj(['getProvider'], {
      // Serverless properties
      cli: ({ log: jasmine.createSpy() }),
      service: jasmine.createSpyObj([], {
        custom: {
          'serverless-child-stack-manager': {
            childStacksNamePrefix: undefined
          } as Partial<ServerlessChildStackManagerConfig>
        }
      })
    });

    const stackManager = new ServerlessStackSetManager(serverless);
    const removeFn = stackManager.hooks['before:remove:remove'];

    // Invoke the actual remove function
    await expectAsync(removeFn()).toBeRejectedWithError(/childStacksNamePrefix is required/);
  });
});
