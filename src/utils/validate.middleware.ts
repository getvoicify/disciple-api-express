import {type ZodType} from "zod";
import {type Request, type Response, type NextFunction} from "express";

export const validate = (
    schema: ZodType,
    key = 'body',
)=> (req: Request, res: Response, next: NextFunction) => {
    const validated = schema.safeParse(req[key]);
    if (!validated.success) {
        return res.status(400).json({error: 'Invalid input', details: validated.error.issues});
    }
    next();
}