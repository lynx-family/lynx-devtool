export function isProcessRunning(pid: unknown): boolean {
  if (typeof pid !== 'number') {
    return false;
  }

  try {
    // Signal 0 does not terminate the process; it checks whether the pid exists
    // and whether this process can signal it.
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // Success: the process exists and can be signaled.
    // ESRCH: the process does not exist.
    // EPERM: the process exists, but cannot be signaled by this process.
    // Return true for EPERM because the process still exists.
    return (error as { code?: string })?.code === 'EPERM';
  }
}
