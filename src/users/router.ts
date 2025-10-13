import { Router } from "express";
import {type ChurchMembershipService} from "../churches/membership-service";
import {validateToken} from "../utils/validate-token.middleware";
import {jwtVerify} from "jose";
import {getUserMembershipsEndpoint} from "./routes/membership/getUserMemberships.endpoint";


export const usersRouter = (membershipService: ChurchMembershipService): Router => {
	const router = Router();
	const {
		IAM_ENDPOINT,
		IAM_REALM,
	} = process.env;
	const tokenVerifier = validateToken(jwtVerify, IAM_ENDPOINT, IAM_REALM);

	router.get('/memberships', [
		tokenVerifier()
	], getUserMembershipsEndpoint(membershipService));

	return router;
}
