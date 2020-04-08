
interface ServerlessChildStackManagerConfig {
  /**
   * Name prefix for child stacks.
   */
  childStacksNamePrefix: string;
  /**
   * What to do with the child stacks when the service is removed via 'serverless remove':
   * - remove => removes all the stacks whose name starts with childStacksNamePrefix.
   * - keep => leaves the stacks in place
   */
  removalPolicy: 'remove' | 'keep';
  /**
   * Optional IAM Role for CloudFormation to assume when removing the child stacks.
   * This role needs permissions to remove resources in the stacks.
   */
  cfnRole?: string;
  /**
   * Maximum number of parallel stack operations to perform.
   * Useful to avoid throttling errors from AWS.
   */
  maxConcurrentCount: number;
  /**
   * The name of the lambda that must be invoked when upgrading a child stack
   */
  upgradeFunction: string;
  /**
   * Whether to continue or not with removing/deploying the rest of the child stacks
   * when a stack is failing to remove/deploy
   */
  continueOnFailure: boolean;
}
