
interface ServerlessChildStackManagerConfig {
  /**
   * Name pattern for child stacks.
   */
  childStacksNamePattern: string;
  /**
   * What to do with the child stacks when the service is removed via 'serverless remove':
   * - remove => removes all the stacks that match the childStacksNamePattern
   * - keep => leaves the stacks in place
   */
  removalPolicy: 'remove' | 'keep';
  /**
   * Optional IAM Role for CloudFormation to assume when removing the child stacks.
   * This role needs permissions to remove resources in the stacks.
   */
  cfnRole?: string;
}
