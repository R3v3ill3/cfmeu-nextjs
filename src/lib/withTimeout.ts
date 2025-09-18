export function withTimeout<T>(promiseLike: PromiseLike<T>, timeoutMs: number, label?: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      const message = label
        ? `${label} timed out after ${timeoutMs}ms`
        : `Operation timed out after ${timeoutMs}ms`;
      const error = new Error(message);
      // @ts-expect-error attach code for potential upstream handling
      (error as any).code = "ETIMEDOUT";
      reject(error);
    }, timeoutMs);
  });

  const guardedPromise = new Promise<T>((resolve, reject) => {
    promiseLike.then(
      (value) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        resolve(value);
      },
      (err) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        reject(err);
      }
    );
  });

  return Promise.race([guardedPromise, timeoutPromise]) as Promise<T>;
}

