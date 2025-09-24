export async function safeExecute<T = unknown>(
    promise: Promise<T>,
): Promise<[Error] | [undefined, T]>;
export async function safeExecute<T = unknown>(
    fn: () => T | Promise<T>,
): Promise<[Error] | [undefined, T]>;
export async function safeExecute<T = unknown>(
    promiseOrFn: Promise<T> | (() => T | Promise<T>),
): Promise<[Error] | [undefined, T]> {
    try {
        const result = typeof promiseOrFn === 'function'
            ? await promiseOrFn()
            : await promiseOrFn;
        return [undefined, result];
    } catch (e) {
        return [e as Error];
    }
}

// Deprecated: Use safeExecute instead
export const handleAsync = safeExecute;
