import {Router} from 'express';
import type {ChurchService} from "../service";
import type {ChurchApprovalService} from "../approval-service";
import {ChurchMembershipService} from "../membership-service";
import {churchCreateEndpoint} from "./churchCreate.endpoint";
import {validateToken} from "../../utils/validate-token.middleware";
import {jwtVerify} from "jose";
import {validate} from "../../utils/validate.middleware";
import {
	ChurchDeleteInput,
	ChurchFetchInput, ChurchIdInput,
	ChurchUpdateInput,
	ChurchUpdateParamsInput,
	CreateChurchInput, RejectionInput
} from "../schemas";
import {churchListEndpoint, ChurchListFilterSchema} from "./churchList.endpoint";
import {churchSearchEndpoint, ChurchSearchInput} from "./churchSearch.endpoint";
import {churchFetchEndpoint} from "./churchFetch.endpoint";
import {churchDeleteEndpoint} from "./churchDelete.endpoint";
import {churchUpdateEndpoint} from "./churchUpdate.endpoint";
import {churchApproveEndpoint} from "./admin/churchApprove.endpoint";
import {churchRejectEndpoint} from "./admin/churchReject.endpoint";
import {churchApprovalHistoryEndpoint} from "./admin/churchApprovalHistory.endpoint";


export const churchesRouter = (
	churchService: ChurchService,
	approvalService: ChurchApprovalService,
	membershipService: ChurchMembershipService
) => {
	const router = Router();
	const {
		IAM_ENDPOINT,
		IAM_REALM,
	} = process.env;
	const tokenVerifier = validateToken(jwtVerify, IAM_ENDPOINT, IAM_REALM);

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
