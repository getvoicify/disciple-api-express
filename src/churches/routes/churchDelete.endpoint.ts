import type {ChurchService} from "../service";
import type {EndpointHandler} from "../../types/endpoint-handler";
import {ChurchDeleteInput} from "../schemas";
import {safeExecute} from "../../utils/handle-async";
import errorCodeFactory from "../../utils/error-code.factory";

/**
 * @openapi
 * /churches/{churchId}:
 *   delete:
 *     summary: Delete a church
 *     description: Delete an existing church. Requires ownership or admin privileges.
 *     tags: [Churches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: churchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The unique identifier of the church to delete
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       204:
 *         description: Church deleted successfully
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - User does not have permission to delete this church
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Church not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const churchDeleteEndpoint = (service: ChurchService): EndpointHandler => async (req, res) => {
	const {churchId} = ChurchDeleteInput.parse(req.params);

	const [err] = await safeExecute(service.deleteChurch(churchId));

	if (err) {
		const code = errorCodeFactory(err);
		res.status(code).json({
			error: err.message,
			success: false,
		});
	} else {
		res.status(204).send();
	}
};
