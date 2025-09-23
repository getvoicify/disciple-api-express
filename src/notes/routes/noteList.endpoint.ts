import express from 'express';
import {z} from "zod";
import type {NoteService} from "../service";
import {NoteFilters} from "../schemas";
import {safeExecute} from "../../utils/handle-async";

export const InputSchema = z.object({
	title: z.string().optional().nullable(),
	content: z.string().optional().nullable(),
	startDate: z.coerce.date().optional().nullable(),
	endDate: z.coerce.date().optional().nullable(),
	book: z.string().optional().nullable(),
	chapter: z.coerce.number().int().positive().optional().nullable(),
	verse: z.coerce.number().int().positive().optional().nullable(),
})

/**
 * @openapi
 * /notes:
 *   get:
 *     summary: List all notes
 *     description: Retrieve a list of notes with optional filtering by title, content, date range, or scripture references
 *     tags: [Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: title
 *         schema:
 *           type: string
 *         description: Filter by note title (partial match)
 *         example: "sermon"
 *       - in: query
 *         name: content
 *         schema:
 *           type: string
 *         description: Filter by note content (partial match)
 *         example: "love"
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter notes created after this date
 *         example: "2024-01-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter notes created before this date
 *         example: "2024-12-31"
 *       - in: query
 *         name: book
 *         schema:
 *           type: string
 *         description: Filter by biblical book name
 *         example: "John"
 *       - in: query
 *         name: chapter
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Filter by biblical chapter number
 *         example: 3
 *       - in: query
 *         name: verse
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Filter by biblical verse number
 *         example: 16
 *     responses:
 *       200:
 *         description: List of notes retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     notes:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Note'
 *                     count:
 *                       type: integer
 *                       description: Number of notes returned
 *                       example: 5
 *       400:
 *         description: Invalid query parameters
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
export const noteListEndpoint = (service: NoteService) =>
	async (req: express.Request, res: express.Response) => {
		const {title, content, startDate, endDate, book, chapter, verse} = InputSchema.parse(req.query);

		const authorizedIds = req['ids'] ?? []

		// Build filters with authorization constraint
		const filters: NoteFilters = {
			authorizedIds,
			title,
			content,
			startDate,
			endDate,
			scripture: {book, chapter, verse},
		};

		if (book || chapter !== undefined || verse !== undefined) {
			filters.scripture = {};
			if (book) {
				filters.scripture.book = book;
			}
			if (chapter !== undefined) {
				filters.scripture.chapter = chapter;
			}
			if (verse !== undefined) {
				filters.scripture.verse = verse;
			}
		}

		const [err, notes] = await safeExecute(service.listNotes(filters));

		if (err) {
			console.log(err);
			res.status(400).json({
				error: err.message,
				success: false,
			})
		} else {
			res.json({
				notes,
				success: true,
				count: notes.length,
			});
		}

	}
