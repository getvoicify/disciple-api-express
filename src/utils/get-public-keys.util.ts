import {createRemoteJWKSet} from "jose";

export  function getPublicKeys(realmUrl: string): ReturnType<typeof createRemoteJWKSet> {
    const publicKeyEndpoint = `${realmUrl}/protocol/openid-connect/certs`;
    return createRemoteJWKSet(new URL(publicKeyEndpoint));
}