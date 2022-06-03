/**
 * Asymmetric matcher that inverts the result of the matcher to use.
 * Example:
 *   .withArgs(notMatching(jasmine.objectContaining({ shouldNotBeHere: jasmine.any(String) })))
 */
function notMatching<T>(matcher: jasmine.AsymmetricMatcher<T>): jasmine.Expected<T> {
  return {
    asymmetricMatch: (compareTo: T, util: jasmine.MatchersUtil): boolean => !matcher.asymmetricMatch(compareTo, util)
  };
}

export default notMatching;
