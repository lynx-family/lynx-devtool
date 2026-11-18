export function getErrorMessage(error: unknown): string | undefined {
  if (!error) {
    return undefined;
  }
  return error instanceof Error ? error.message : String(error);
}
