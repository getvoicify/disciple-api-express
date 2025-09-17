import type {NoteService} from "../service";
import express from "express";
import {UpdateNoteInput} from "../schemas";
import {z} from "zod";
import {handleAsync} from "../../utils/handle-async";

export const NoteUpdateParamsInput = z.object({
    noteId: z.uuid(),
});

/**
 * @openapi
 * /notes/{noteId}:
 *   put:
 *     summary: Update an existing note
 *     description: Update a note's title, content, scripture references, or images. All fields are optional.
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
 *         description: The unique identifier of the note to update
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateNoteInput'
 *           examples:
 *             titleOnly:
 *               summary: Update title only
 *               value:
 *                 title: "Updated Sermon Title"
 *             fullUpdate:
 *               summary: Full update
 *               value:
 *                 title: "God's Amazing Grace"
 *                 content: "Updated content about grace and mercy"
 *                 scriptureReferences:
 *                   - book: "Ephesians"
 *                     chapter: 2
 *                     verse: 8
 *                     endVerse: 9
 *     responses:
 *       200:
 *         description: Note updated successfully
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
 *         description: Invalid input data or note ID format
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
export const noteUpdateEndpoint = (service: NoteService) =>
    async (req: express.Request, res: express.Response) => {
        const {noteId} = NoteUpdateParamsInput.parse(req.params);
        const updateData = UpdateNoteInput.parse(req.body);

        const [err, note] = await handleAsync(service.updateNote(noteId, updateData));

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
            })
        }
    }