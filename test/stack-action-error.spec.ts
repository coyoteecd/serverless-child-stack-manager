import { StackActionError } from '../src/stack-action-error';

describe('Stack Error', () => {
  it('should create the StackActionError', () => {
    const id = 'the stack id';
    const msg = 'the error message';
    const error = new StackActionError(id, msg);
    expect(error).toBeTruthy();
    expect(error.stackId).toBe(id);
    expect(error.message).toBe(msg);
  });
});
