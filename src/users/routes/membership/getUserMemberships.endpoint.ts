import {ChurchMembershipService} from "../../../churches/membership-service";
import {EndpointHandler} from "../../../types/endpoint-handler";
import {handleAsync} from "../../../utils/handle-async";
import errorCodeFactory from "../../../utils/error-code.factory";

/**
 * @openapi
 * /api/users/memberships:
 *   get:
 *     summary: Get user's church memberships
 *     description: Retrieve all active church memberships for the authenticated user
 *     tags: [Users, Church Membership]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved user's church memberships
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, memberships]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 memberships:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ChurchMember'
 *                   description: Array of active church memberships for the user
 *             example:
 *               success: true
 *               memberships:
 *                 - id: "123e4567-e89b-12d3-a456-426614174000"
 *                   churchId: "987fcdeb-51a2-43d1-9c14-556677889900"
 *                   userId: "456e7890-e89b-12d3-a456-426614174111"
 *                   role: "Member"
 *                   status: "Active"
 *                   joinedAt: "2024-01-15T10:30:00.000Z"
 *                   updatedAt: "2024-01-15T10:30:00.000Z"
 *                   invitedBy: "789e0123-e89b-12d3-a456-426614174222"
 *                   invitedAt: "2024-01-14T15:20:00.000Z"
 *                 - id: "234e5678-e89b-12d3-a456-426614174001"
 *                   churchId: "098fcdeb-51a2-43d1-9c14-556677889901"
 *                   userId: "456e7890-e89b-12d3-a456-426614174111"
 *                   role: "Manager"
 *                   status: "Active"
 *                   joinedAt: "2024-02-01T08:15:00.000Z"
 *                   updatedAt: "2024-02-01T08:15:00.000Z"
 *                   invitedBy: null
 *                   invitedAt: null
 *       400:
 *         description: Bad request - Invalid user ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Invalid UUID format"
 *       401:
 *         description: Unauthorized - Invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Unauthorized"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Internal server error"
 */
export const getUserMembershipsEndpoint = (service: ChurchMembershipService): EndpointHandler => async (req, res) => {
	const user = req.user?.[0];
	const userId = user?.sub;

	const [ err, memberships ] = await handleAsync(service.getUserMemberships(userId));

	if (err) {
		const code = errorCodeFactory(err);

		res.status(code).json({
			error: err.message,
			success: false,
		});
	} else {
		res.json({
			success: true,
			memberships,
		});
	}
}
