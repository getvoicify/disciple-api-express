import type {NoteService} from "../service";
import type express from "express";
import {z} from "zod";
import {safeExecute} from "../../utils/handle-async";

export const NoteDeleteParamsInput = z.object({
    noteId: z.uuid(),
});

/**
 * @openapi
 * /notes/{noteId}:
 *   delete:
 *     summary: Delete a note
 *     description: Permanently delete a note by its unique identifier
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
 *         description: The unique identifier of the note to delete
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       204:
 *         description: Note deleted successfully (no content)
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
export const noteDeleteEndpoint = (service: NoteService) =>
    async (req: express.Request, res: express.Response) => {
        const {noteId} = NoteDeleteParamsInput.parse(req.params);
        const [err] = await safeExecute(service.deleteNote(noteId));
        if (err) {
            const code = err.message === 'Note not found' ? 404 : 400;
            res.status(code).json({
                error: err.message,
                success: false,
            });
        } else {
            res.status(204).send();
        }
    }