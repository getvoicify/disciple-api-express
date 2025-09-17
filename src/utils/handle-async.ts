export async function handleAsync<T = unknown>(
    promise: Promise<T>,
): Promise<[Error] | [undefined, T]> {
    try {
        const result = await promise;
        return [undefined, result];
    } catch (e) {
        return [e as Error];
    }
}