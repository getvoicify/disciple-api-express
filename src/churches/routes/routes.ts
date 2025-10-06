import {Router} from 'express';
import type {ChurchService} from "../service";
import type {ChurchApprovalService} from "../approval-service";
import {ChurchMembershipService} from "../membership-service";
import type {GalleryService} from "../../gallery/service";
import {churchCreateEndpoint} from "./churchCreate.endpoint";
import {validateToken} from "../../utils/validate-token.middleware";
import {jwtVerify} from "jose";
import {validate} from "../../utils/validate.middleware";
import {
	ChurchDeleteInput,
	ChurchFetchInput,
	ChurchIdInput,
	ChurchUpdateInput,
	ChurchUpdateParamsInput,
	CreateChurchInput,
	InvitationInput,
	PendingChurchListQueryInput,
	RejectionInput,
	UserIdInput,
	UpdateRoleInput
} from "../schemas";
import {galleryRouter} from "../../gallery/routes/routes";
import {churchListEndpoint, ChurchListFilterSchema} from "./churchList.endpoint";
import {churchSearchEndpoint, ChurchSearchInput} from "./churchSearch.endpoint";
import {churchFetchEndpoint} from "./churchFetch.endpoint";
import {churchDeleteEndpoint} from "./churchDelete.endpoint";
import {churchUpdateEndpoint} from "./churchUpdate.endpoint";
import {churchApproveEndpoint} from "./admin/churchApprove.endpoint";
import {churchRejectEndpoint} from "./admin/churchReject.endpoint";
import {churchApprovalHistoryEndpoint} from "./admin/churchApprovalHistory.endpoint";
import {churchPendingListEndpoint} from "./admin/churchPendingList.endpoint";
import {churchMembershipJoinEndpoint} from "./membership/churchMembershipJoin.endpoint";
import {churchMembershipLeaveEndpoint} from "./membership/churchMembershipLeave.endpoint";
import {churchMembershipListEndpoint} from "./membership/churchMembershipList.endpoint";
import {churchMembershipInviteEndpoint} from "./membership/churchMembershipInvite.endpoint";
import {churchMembershipAcceptInviteEndpoint} from "./membership/churchMembershipAcceptInvite.endpoint";
import {churchMembershipDeclineInviteEndpoint} from "./membership/churchMembershipDeclineInvite.endpoint";
import {churchMembershipRemoveMemberEndpoint} from "./membership/churchMembershipRemoveMember.endpoint";
import {churchMembershipBanEndpoint} from "./membership/churchMembershipBan.endpoint";
import {churchMembershipUpdateRoleEndpoint} from "./membership/churchMembershipUpdateRole.endpoint";


export const churchesRouter = (
	churchService: ChurchService,
	approvalService: ChurchApprovalService,
	membershipService: ChurchMembershipService,
	galleryService?: GalleryService
) => {
	const router = Router();
	const {
		IAM_ENDPOINT,
		IAM_REALM,
	} = process.env;
	const tokenVerifier = validateToken(jwtVerify, IAM_ENDPOINT, IAM_REALM);

	// Mount gallery routes under /:churchId/galleries
	if (galleryService) {
		router.use('/:churchId/galleries', galleryRouter(galleryService));
	}

	router.get('/pending', [
		tokenVerifier(true),
		validate(PendingChurchListQueryInput, 'query'),
	], churchPendingListEndpoint(approvalService));

	// Admin endpoints
	router.get(':churchId/approval-history', [
		tokenVerifier(true),
		validate(ChurchIdInput, 'params')
	], churchApprovalHistoryEndpoint(approvalService));

	router.post(':churchId/approve', [
		tokenVerifier(true),
		validate(ChurchIdInput, 'params')
	], churchApproveEndpoint(approvalService));

	router.post(':churchId/reject', [
		tokenVerifier(true),
		validate(ChurchIdInput, 'params'),
		validate(RejectionInput, 'body'),
	], churchRejectEndpoint(approvalService));

	// Membership endpoints

	router.post(':churchId/join', [
		tokenVerifier(true),
		validate(ChurchIdInput, 'params')
	], churchMembershipJoinEndpoint(membershipService));

	router.post(':churchId/leave', [
		tokenVerifier(true),
		validate(ChurchIdInput, 'params')
	], churchMembershipLeaveEndpoint(membershipService));

	router.get(':churchId/members', [
		tokenVerifier(false),
		validate(ChurchIdInput, 'params')
	], churchMembershipListEndpoint(membershipService));

	router.post(':churchId/invite', [
		tokenVerifier(true),
		validate(InvitationInput, 'body')
	], churchMembershipInviteEndpoint(membershipService));

	router.post(':churchId/accept-invitation', [
		tokenVerifier(true),
		validate(ChurchIdInput, 'params')
	], churchMembershipAcceptInviteEndpoint(membershipService));

	router.post(':churchId/decline-invitation', [
		tokenVerifier(true),
		validate(ChurchIdInput, 'params')
	], churchMembershipDeclineInviteEndpoint(membershipService));

	router.delete(':churchId/members/:userId', [
		tokenVerifier(true),
		validate(ChurchIdInput, 'params'),
		validate(UserIdInput, 'params')
	], churchMembershipRemoveMemberEndpoint(membershipService));

	router.post(':churchId/members/:userId/ban', [
		tokenVerifier(true),
		validate(ChurchIdInput, 'params'),
		validate(UserIdInput, 'params')
	], churchMembershipBanEndpoint(membershipService));

	router.put(':churchId/members/:userId/role', [
		tokenVerifier(true),
		validate(ChurchIdInput, 'params'),
		validate(UserIdInput, 'params'),
		validate(UpdateRoleInput, 'body')
	], churchMembershipUpdateRoleEndpoint(membershipService));

	router.delete(':churchId', [
		tokenVerifier(true),
		validate(ChurchDeleteInput, 'params')
	], churchDeleteEndpoint(churchService));

	router.get(
		':churchId',
		[
			tokenVerifier(false),
			validate(ChurchFetchInput, 'params')
		],
		churchFetchEndpoint(churchService)
	);

	router.put(':churchId', [
		tokenVerifier(true),
		validate(ChurchUpdateParamsInput, 'params'),
		validate(ChurchUpdateInput, 'body'),
	], churchUpdateEndpoint(churchService));

	router.get('/search', [validate(ChurchSearchInput, 'query')], churchSearchEndpoint(churchService));

	router.post('/', [
		tokenVerifier(true),
		validate(CreateChurchInput, 'body'),
	], churchCreateEndpoint(churchService));

	router.get('/', [
		tokenVerifier(false),
		validate(ChurchListFilterSchema, 'query'),
	], churchListEndpoint(churchService));

	return router;
}
