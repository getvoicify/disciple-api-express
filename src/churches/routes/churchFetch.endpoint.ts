import type {ChurchService} from "../service";
import type {EndpointHandler} from "../../types/endpoint-handler";
import {handleAsync} from "../../utils/handle-async";
import {ChurchFetchInput} from "../schemas";

/**
 * @openapi
 * /churches/{churchId}:
 *   get:
 *     summary: Get church by ID
 *     description: Retrieve detailed information about a specific church
 *     tags: [Churches]
 *     parameters:
 *       - in: path
 *         name: churchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The unique identifier of the church
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Church details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     church:
 *                       $ref: '#/components/schemas/Church'
 *       404:
 *         description: Church not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       400:
 *         description: Invalid church ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const churchFetchEndpoint = (service: ChurchService): EndpointHandler => async (req, res) => {
	const {churchId} = ChurchFetchInput.parse(req.params);
	const [err, church] = await handleAsync(service.getChurchById(churchId));
	const errCodeFn = (err: Error) => {
		if (err.message.includes('not found')) {
			return 404;
		}
		return 400;
	}

	if (err) {
		const code = errCodeFn(err);
		res.status(code).json({
			error: err.message,
			success: false,
		});
	} else {
		res.json({
			success: true,
			church,
		})
	}
};
