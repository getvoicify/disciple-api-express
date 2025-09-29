export type KeyEnvPrefixerFactory = (key: string) => string;
export type KeyEnvPrefixerArgs = KeyEnvPrefixerFactory | string;

export type keyEnvPrefixer<T extends string = string> = (key: KeyEnvPrefixerArgs) => T;

export const keyEnvPrefixer: keyEnvPrefixer = (key) => {
	const env = process.env.NODE_ENV;
	if (typeof key === 'function') {
		return key(env);
	}
	return `${env}:${key}`;
}
