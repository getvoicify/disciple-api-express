import express from 'express';

export type EndpointHandler = (req: express.Request, res: express.Response) => Promise<void>;
