// eslint-disable-next-line import/prefer-default-export
export class StackActionError extends Error {
  readonly stackId: string;

  constructor(stack: string, message: string) {
    super(message);
    this.stackId = stack;
  }
}
