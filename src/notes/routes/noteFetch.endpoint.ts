import {z} from 'zod';
import type {NoteService} from "../service";
import type express from "express";
import {safeExecute} from "../../utils/handle-async";

export const NoteFetchParamsInput = z.object({
    noteId: z.uuid(),
});

/**
 * @openapi
 * /notes/{noteId}:
 *   get:
 *     summary: Get a specific note
 *     description: Retrieve a single note by its unique identifier
 *     tags: [Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The unique identifier of the note to retrieve
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Note retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     note:
 *                       $ref: '#/components/schemas/Note'
 *       400:
 *         description: Invalid note ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Note not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const noteFetchEndpoint = (service: NoteService) =>
    async (req: express.Request, res: express.Response) => {
        const { noteId } = NoteFetchParamsInput.parse(req.params);
        const [err, note] = await safeExecute(service.getNoteById(noteId));

        if (err) {
            const code = err.message === 'Note not found' ? 404 : 400;
            res.status(code).json({
                error: err.message,
                success: false,
            });
        } else {
            res.json({
                note,
                success: true,
            });
        }
    };