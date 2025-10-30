import {type ChurchMembershipService} from "../../membership-service";
import {type EndpointHandler} from "../../../types/endpoint-handler";
import {ChurchIdInput} from "../../schemas";
import {safeExecute} from "../../../utils/handle-async";
import errorCodeFactory from "../../../utils/error-code.factory";
import type {ChurchMembershipOutboxAdapter} from "../../church-membership-outbox.adapter";
import {logger} from "../../../logging";

export const churchMembershipLeaveEndpoint = (
	service: ChurchMembershipService,
	outboxAdapter?: ChurchMembershipOutboxAdapter
): EndpointHandler => async (req, res) => {
	const user = req.user?.[1]?.payload;
	const userId = user?.sub;
	const {churchId} = ChurchIdInput.parse(req.params);

	const [err] = await safeExecute(service.leaveChurch(churchId, userId));

	if (err) {
		const code = errorCodeFactory(err);
		res.status(code).json({
			error: err.message,
			success: false,
		});
		return;
	}

	// Emit member-left event AFTER successfully leaving church
	if (outboxAdapter) {
		const [eventErr] = await safeExecute(
			outboxAdapter.enqueueMemberLeft(
				churchId,
				userId,
				{
					timestamp: Date.now(),
				}
			)
		);

		if (eventErr) {
			logger.error(
				{ error: eventErr, churchId, userId },
				'Failed to enqueue member-left event'
			);
			// Don't fail the request if event emission fails
			// The user left the church successfully
		}
	}

	res.status(204).send();
};
