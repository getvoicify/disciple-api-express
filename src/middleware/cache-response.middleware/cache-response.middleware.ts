import {type CacheRepository} from "../../cache";
import {type Middleware} from "../../utils/middleware";
import {safeExecute} from "../../utils/handle-async";

export const cacheResponseMiddleware = (cacheRepo: CacheRepository): Middleware => async (req, res, next) => {
	const key = req['key'];

	if (!key) {
		next();
		return;
	}

	const [ err, cached ] = await safeExecute(cacheRepo.read(key));

	if (err) {
		next();
		return;
	}

	if (cached) {
		console.log(`Cache hit: ${key}`);
		res.status(200).json(cached);
	}
}
