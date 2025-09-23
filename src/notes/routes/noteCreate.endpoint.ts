import type {NoteService} from "../service";
import express from "express";
import {CreateNoteInput} from "../schemas";
import {safeExecute} from "../../utils/handle-async";

/**
 * @openapi
 * /notes:
 *   post:
 *     summary: Create a new note
 *     description: Create a new sermon note with optional scripture references and images
 *     tags: [Notes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateNoteInput'
 *           examples:
 *             basic:
 *               summary: Basic note
 *               value:
 *                 title: "Sunday Sermon Notes"
 *                 content: "God so loved the world that he gave his one and only Son..."
 *             withScripture:
 *               summary: Note with scripture references
 *               value:
 *                 title: "God's Love"
 *                 content: "Amazing message about God's unconditional love"
 *                 scriptureReferences:
 *                   - book: "John"
 *                     chapter: 3
 *                     verse: 16
 *     responses:
 *       201:
 *         description: Note created successfully
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
 *         description: Invalid input data
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
 */
export const noteCreateEndpoint = (service: NoteService) =>
    async (req: express.Request, res: express.Response) => {
        const noteToCreate = CreateNoteInput.parse(req.body);
        const [err, note] = await safeExecute(service.createNote(noteToCreate, ''));

        if (err) {
            res.status(400).json({
                error: err.message,
                success: false,
            });
        } else {
            res.status(201).json({
                note,
                success: true,
            })
        }
    }