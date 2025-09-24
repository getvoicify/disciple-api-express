import type {ChurchService} from "../service";
import type {EndpointHandler} from "../../types/endpoint-handler";
import {CreateChurchInput} from "../schemas";
import type {User} from "../../utils/validate-token.middleware";
import {safeExecute} from "../../utils/handle-async";

/**
 * @openapi
 * /churches:
 *   post:
 *     summary: Create a new church
 *     description: Create a new church with basic information and optional address details
 *     tags: [Churches]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateChurchInput'
 *           examples:
 *             basic:
 *               summary: Basic church
 *               value:
 *                 name: "Grace Community Church"
 *                 description: "A welcoming church community"
 *                 websiteUrl: "https://gracecommunity.org"
 *             withAddress:
 *               summary: Church with full details
 *               value:
 *                 name: "Faith Assembly"
 *                 description: "Non-denominational church serving the community"
 *                 byline: "Where faith meets community"
 *                 missionStatement: "To spread love and serve our community"
 *                 address:
 *                   street: "123 Main St"
 *                   city: "Springfield"
 *                   state: "IL"
 *                   zipCode: "62701"
 *                   country: "USA"
 *                 phoneNumber: "+1-555-0123"
 *                 email: "info@faithassembly.org"
 *                 websiteUrl: "https://faithassembly.org"
 *                 logoUrl: "https://example.com/logo.png"
 *                 coverImageUrl: "https://example.com/cover.jpg"
 *                 latitude: 39.7817
 *                 longitude: -89.6501
 *                 socialLinks:
 *                   facebook: "https://facebook.com/faithassembly"
 *                   instagram: "https://instagram.com/faithassembly"
 *                   youtube: "https://youtube.com/faithassembly"
 *     responses:
 *       201:
 *         description: Church created successfully
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
 */
export const churchCreateEndpoint = (service: ChurchService): EndpointHandler => async (req, res) => {
	const churchToCreate = CreateChurchInput.parse(req.body);
	const user = req['user']?.[1].payload as any;

	if (!user) {
		res.status(401).json({
			error: 'Unauthorized',
			success: false,
		});
		return;
	}
	const ownerId = user.sub;

	const [err, createdChurch] = await safeExecute(service.createChurch(churchToCreate, ownerId));

	if (err) {
		res.status(400).json({
			error: err.message,
			success: false,
		});
	} else {
		res.status(201).json({
			success: true,
			church: createdChurch
		})
	}
};
