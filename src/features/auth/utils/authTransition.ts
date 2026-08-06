export const AUTH_SUCCESS_DELAY_MS = 1000;

export function waitForAuthSuccessScreen(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, AUTH_SUCCESS_DELAY_MS);
  });
}
