import { z } from 'zod';

export const JwkKeySchema = z.object({
    kid: z.string(),
    kty: z.string(),
    alg: z.string(),
    use: z.string(),
    n: z.string(),
    e: z.string(),
    x5c: z.array(z.string()),
    x5t: z.string(),
    // Use bracket notation for property names that include special characters:
    ['x5t#S256']: z.string(),
});

export const JwkSetSchema = z.object({
    keys: z.array(JwkKeySchema),
});

export type JwkSet = z.infer<typeof JwkSetSchema>;