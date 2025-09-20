import express from 'express';
import {User} from "../utils/validate-token.middleware";


type EndpointRequest = express.Request & {
    user?: User;
};
export type EndpointHandler = (req: EndpointRequest, res: express.Response) => Promise<void>;
