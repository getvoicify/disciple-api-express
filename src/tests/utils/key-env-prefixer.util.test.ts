import {describe, expect, it, vi} from 'vitest';
import {keyEnvPrefixer} from "../../utils/key-env-prefixer.util";

const mockEnv = {
	NODE_ENV: 'test',
};

// Mock external dependencies
vi.mock('process', () => ({
	env: mockEnv
}));

describe('keyEnvPrefixer', () => {
	it('should prefix string input with env', () => {
		expect(keyEnvPrefixer('test-key')).toBe('test:test-key');
	});

	it('should prefix factory input with env', () => {
		const factory = vi.fn(() => 'test:test-key');
		const result = keyEnvPrefixer(factory);
		expect(factory).toBeCalledWith('test');
		expect(result).toBe('test:test-key');
	});
})
