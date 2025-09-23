import type {ChurchService} from "../service";
import type {EndpointHandler} from "../../types/endpoint-handler";
import {ChurchUpdateInput, ChurchUpdateParamsInput} from "../schemas";
import {safeExecute} from "../../utils/handle-async";
import errorCodeFactory from "../../utils/error-code.factory";

/**
 * @openapi
 * /churches/{churchId}:
 *   put:
 *     summary: Update a church
 *     description: Update an existing church's information. Requires ownership or admin privileges.
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
 *         description: The unique identifier of the church to update
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/UpdateChurchInput'
 *               - type: object
 *                 required: [version]
 *                 properties:
 *                   version:
 *                     type: integer
 *                     description: Current version number for optimistic concurrency control
 *                     example: 2
 *           examples:
 *             updateBasicInfo:
 *               summary: Update basic information
 *               value:
 *                 name: "Grace Community Church - Main Campus"
 *                 description: "Updated church description"
 *                 websiteUrl: "https://gracecommunity.org"
 *                 version: 1
 *             updateContact:
 *               summary: Update contact information
 *               value:
 *                 phoneNumber: "+1-555-9876"
 *                 email: "contact@gracecommunity.org"
 *                 version: 2
 *             updateAddress:
 *               summary: Update address
 *               value:
 *                 address:
 *                   street: "456 Church Ave"
 *                   city: "Springfield"
 *                   state: "IL"
 *                   zipCode: "62702"
 *                   country: "USA"
 *                 latitude: 39.7817
 *                 longitude: -89.6501
 *                 version: 3
 *             updateSocialLinks:
 *               summary: Update social media links
 *               value:
 *                 socialLinks:
 *                   facebook: "https://facebook.com/gracecommunity"
 *                   instagram: "https://instagram.com/gracecommunity"
 *                   twitterX: "https://twitter.com/gracecommunity"
 *                   youtube: "https://youtube.com/gracecommunity"
 *                   tiktok: "https://tiktok.com/@gracecommunity"
 *                 version: 4
 *     responses:
 *       200:
 *         description: Church updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     church:
 *                       $ref: '#/components/schemas/Church'
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
 *       403:
 *         description: Forbidden - User does not have permission to update this church
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
 *       409:
 *         description: Version conflict - The church has been modified by another user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const churchUpdateEndpoint = (service: ChurchService): EndpointHandler => async (req, res) => {
	const {churchId} = ChurchUpdateParamsInput.parse(req.params);
	const {version, ...updateData} = ChurchUpdateInput.parse(req.body);

	const [err, church] = await safeExecute(service.updateChurch(churchId, updateData, version));

	if (err) {
		const code = errorCodeFactory(err);
		res.status(code).json({
			error: err.message,
			success: false,
		});
	} else {
		res.json({
			success: true,
			church
		})
	}
};
