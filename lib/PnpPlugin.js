/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Maël Nison @arcanis
*/

"use strict";

/** @typedef {import("./Resolver")} Resolver */
/** @typedef {import("./Resolver").ResolveStepHook} ResolveStepHook */
/**
 * @typedef {Object} PnpApiImpl
 * @property {function(string, string, Object): string} resolveToUnqualified
 */

module.exports = class PnpPlugin {
	/**
	 * @param {string | ResolveStepHook} source source
	 * @param {PnpApiImpl} pnpApi pnpApi
	 * @param {string | ResolveStepHook} target target
	 */
	constructor(source, pnpApi, target) {
		this.source = source;
		this.pnpApi = pnpApi;
		this.target = target;
	}

	/**
	 * @param {Resolver} resolver the resolver
	 * @returns {void}
	 */
	apply(resolver) {
		const target = resolver.ensureHook(this.target);
		resolver
			.getHook(this.source)
			.tapAsync("PnpPlugin", (request, resolveContext, callback) => {
				const req = request.request;
				if (!req) return callback();

				// The trailing slash indicates to PnP that this value is a folder rather than a file
				const issuer = `${request.path}/`;

				let resolution;
				let apiResolution;
				try {
					resolution = this.pnpApi.resolveToUnqualified(req, issuer, {
						considerBuiltins: false
					});
					if (resolveContext.fileDependencies) {
						apiResolution = this.pnpApi.resolveToUnqualified("pnpapi", issuer, {
							considerBuiltins: false
						});
					}
				} catch (error) {
					return callback(error);
				}

				if (resolution === req) return callback();

				if (apiResolution && resolveContext.fileDependencies) {
					resolveContext.fileDependencies.add(apiResolution);
				}

				const obj = {
					...request,
					path: resolution,
					request: undefined,
					ignoreSymlinks: true
				};
				resolver.doResolve(
					target,
					obj,
					`resolved by pnp to ${resolution}`,
					resolveContext,
					(err, result) => {
						if (err) return callback(err);
						if (result) return callback(null, result);
						// Skip alternatives
						return callback(null, null);
					}
				);
			});
	}
};
