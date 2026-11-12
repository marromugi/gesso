/**
 * A failure the person running the CLI can act on. `main` prints its message, which says what to
 * do next, and exits with 1; any other error is a bug and is printed with its stack.
 */
export class CliError extends Error {
  override name = "CliError";
}
