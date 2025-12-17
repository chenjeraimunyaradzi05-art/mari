"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "app/api/profiles/[id]/follow/route";
exports.ids = ["app/api/profiles/[id]/follow/route"];
exports.modules = {

/***/ "@prisma/client":
/*!*********************************!*\
  !*** external "@prisma/client" ***!
  \*********************************/
/***/ ((module) => {

module.exports = require("@prisma/client");

/***/ }),

/***/ "../../client/components/action-async-storage.external":
/*!*******************************************************************************!*\
  !*** external "next/dist/client/components/action-async-storage.external.js" ***!
  \*******************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/client/components/action-async-storage.external.js");

/***/ }),

/***/ "../../client/components/request-async-storage.external":
/*!********************************************************************************!*\
  !*** external "next/dist/client/components/request-async-storage.external.js" ***!
  \********************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/client/components/request-async-storage.external.js");

/***/ }),

/***/ "../../client/components/static-generation-async-storage.external":
/*!******************************************************************************************!*\
  !*** external "next/dist/client/components/static-generation-async-storage.external.js" ***!
  \******************************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/client/components/static-generation-async-storage.external.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-route.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-route.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");

/***/ }),

/***/ "assert":
/*!*************************!*\
  !*** external "assert" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("assert");

/***/ }),

/***/ "buffer":
/*!*************************!*\
  !*** external "buffer" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("buffer");

/***/ }),

/***/ "crypto":
/*!*************************!*\
  !*** external "crypto" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),

/***/ "events":
/*!*************************!*\
  !*** external "events" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("events");

/***/ }),

/***/ "http":
/*!***********************!*\
  !*** external "http" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("http");

/***/ }),

/***/ "https":
/*!************************!*\
  !*** external "https" ***!
  \************************/
/***/ ((module) => {

module.exports = require("https");

/***/ }),

/***/ "querystring":
/*!******************************!*\
  !*** external "querystring" ***!
  \******************************/
/***/ ((module) => {

module.exports = require("querystring");

/***/ }),

/***/ "url":
/*!**********************!*\
  !*** external "url" ***!
  \**********************/
/***/ ((module) => {

module.exports = require("url");

/***/ }),

/***/ "util":
/*!***********************!*\
  !*** external "util" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("util");

/***/ }),

/***/ "zlib":
/*!***********************!*\
  !*** external "zlib" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("zlib");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fprofiles%2F%5Bid%5D%2Ffollow%2Froute&page=%2Fapi%2Fprofiles%2F%5Bid%5D%2Ffollow%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fprofiles%2F%5Bid%5D%2Ffollow%2Froute.ts&appDir=C%3A%5CUsers%5Cmutir%5COneDrive%5CDesktop%5Cmari%5Cguide%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5Cmutir%5COneDrive%5CDesktop%5Cmari%5Cguide&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!":
/*!********************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fprofiles%2F%5Bid%5D%2Ffollow%2Froute&page=%2Fapi%2Fprofiles%2F%5Bid%5D%2Ffollow%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fprofiles%2F%5Bid%5D%2Ffollow%2Froute.ts&appDir=C%3A%5CUsers%5Cmutir%5COneDrive%5CDesktop%5Cmari%5Cguide%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5Cmutir%5COneDrive%5CDesktop%5Cmari%5Cguide&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \********************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   originalPathname: () => (/* binding */ originalPathname),\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   requestAsyncStorage: () => (/* binding */ requestAsyncStorage),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   staticGenerationAsyncStorage: () => (/* binding */ staticGenerationAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/future/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/next/dist/server/future/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/future/route-kind */ \"(rsc)/./node_modules/next/dist/server/future/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var C_Users_mutir_OneDrive_Desktop_mari_guide_app_api_profiles_id_follow_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./app/api/profiles/[id]/follow/route.ts */ \"(rsc)/./app/api/profiles/[id]/follow/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"\"\nconst routeModule = new next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/profiles/[id]/follow/route\",\n        pathname: \"/api/profiles/[id]/follow\",\n        filename: \"route\",\n        bundlePath: \"app/api/profiles/[id]/follow/route\"\n    },\n    resolvedPagePath: \"C:\\\\Users\\\\mutir\\\\OneDrive\\\\Desktop\\\\mari\\\\guide\\\\app\\\\api\\\\profiles\\\\[id]\\\\follow\\\\route.ts\",\n    nextConfigOutput,\n    userland: C_Users_mutir_OneDrive_Desktop_mari_guide_app_api_profiles_id_follow_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { requestAsyncStorage, staticGenerationAsyncStorage, serverHooks } = routeModule;\nconst originalPathname = \"/api/profiles/[id]/follow/route\";\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        serverHooks,\n        staticGenerationAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIuanM/bmFtZT1hcHAlMkZhcGklMkZwcm9maWxlcyUyRiU1QmlkJTVEJTJGZm9sbG93JTJGcm91dGUmcGFnZT0lMkZhcGklMkZwcm9maWxlcyUyRiU1QmlkJTVEJTJGZm9sbG93JTJGcm91dGUmYXBwUGF0aHM9JnBhZ2VQYXRoPXByaXZhdGUtbmV4dC1hcHAtZGlyJTJGYXBpJTJGcHJvZmlsZXMlMkYlNUJpZCU1RCUyRmZvbGxvdyUyRnJvdXRlLnRzJmFwcERpcj1DJTNBJTVDVXNlcnMlNUNtdXRpciU1Q09uZURyaXZlJTVDRGVza3RvcCU1Q21hcmklNUNndWlkZSU1Q2FwcCZwYWdlRXh0ZW5zaW9ucz10c3gmcGFnZUV4dGVuc2lvbnM9dHMmcGFnZUV4dGVuc2lvbnM9anN4JnBhZ2VFeHRlbnNpb25zPWpzJnJvb3REaXI9QyUzQSU1Q1VzZXJzJTVDbXV0aXIlNUNPbmVEcml2ZSU1Q0Rlc2t0b3AlNUNtYXJpJTVDZ3VpZGUmaXNEZXY9dHJ1ZSZ0c2NvbmZpZ1BhdGg9dHNjb25maWcuanNvbiZiYXNlUGF0aD0mYXNzZXRQcmVmaXg9Jm5leHRDb25maWdPdXRwdXQ9JnByZWZlcnJlZFJlZ2lvbj0mbWlkZGxld2FyZUNvbmZpZz1lMzAlM0QhIiwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQUFzRztBQUN2QztBQUNjO0FBQzRDO0FBQ3pIO0FBQ0E7QUFDQTtBQUNBLHdCQUF3QixnSEFBbUI7QUFDM0M7QUFDQSxjQUFjLHlFQUFTO0FBQ3ZCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQSxZQUFZO0FBQ1osQ0FBQztBQUNEO0FBQ0E7QUFDQTtBQUNBLFFBQVEsaUVBQWlFO0FBQ3pFO0FBQ0E7QUFDQSxXQUFXLDRFQUFXO0FBQ3RCO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDdUg7O0FBRXZIIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vbGFyYXZlbC10by1uZXh0anMtbWlncmF0aW9uLz83ZWUyIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwcFJvdXRlUm91dGVNb2R1bGUgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9mdXR1cmUvcm91dGUtbW9kdWxlcy9hcHAtcm91dGUvbW9kdWxlLmNvbXBpbGVkXCI7XG5pbXBvcnQgeyBSb3V0ZUtpbmQgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9mdXR1cmUvcm91dGUta2luZFwiO1xuaW1wb3J0IHsgcGF0Y2hGZXRjaCBhcyBfcGF0Y2hGZXRjaCB9IGZyb20gXCJuZXh0L2Rpc3Qvc2VydmVyL2xpYi9wYXRjaC1mZXRjaFwiO1xuaW1wb3J0ICogYXMgdXNlcmxhbmQgZnJvbSBcIkM6XFxcXFVzZXJzXFxcXG11dGlyXFxcXE9uZURyaXZlXFxcXERlc2t0b3BcXFxcbWFyaVxcXFxndWlkZVxcXFxhcHBcXFxcYXBpXFxcXHByb2ZpbGVzXFxcXFtpZF1cXFxcZm9sbG93XFxcXHJvdXRlLnRzXCI7XG4vLyBXZSBpbmplY3QgdGhlIG5leHRDb25maWdPdXRwdXQgaGVyZSBzbyB0aGF0IHdlIGNhbiB1c2UgdGhlbSBpbiB0aGUgcm91dGVcbi8vIG1vZHVsZS5cbmNvbnN0IG5leHRDb25maWdPdXRwdXQgPSBcIlwiXG5jb25zdCByb3V0ZU1vZHVsZSA9IG5ldyBBcHBSb3V0ZVJvdXRlTW9kdWxlKHtcbiAgICBkZWZpbml0aW9uOiB7XG4gICAgICAgIGtpbmQ6IFJvdXRlS2luZC5BUFBfUk9VVEUsXG4gICAgICAgIHBhZ2U6IFwiL2FwaS9wcm9maWxlcy9baWRdL2ZvbGxvdy9yb3V0ZVwiLFxuICAgICAgICBwYXRobmFtZTogXCIvYXBpL3Byb2ZpbGVzL1tpZF0vZm9sbG93XCIsXG4gICAgICAgIGZpbGVuYW1lOiBcInJvdXRlXCIsXG4gICAgICAgIGJ1bmRsZVBhdGg6IFwiYXBwL2FwaS9wcm9maWxlcy9baWRdL2ZvbGxvdy9yb3V0ZVwiXG4gICAgfSxcbiAgICByZXNvbHZlZFBhZ2VQYXRoOiBcIkM6XFxcXFVzZXJzXFxcXG11dGlyXFxcXE9uZURyaXZlXFxcXERlc2t0b3BcXFxcbWFyaVxcXFxndWlkZVxcXFxhcHBcXFxcYXBpXFxcXHByb2ZpbGVzXFxcXFtpZF1cXFxcZm9sbG93XFxcXHJvdXRlLnRzXCIsXG4gICAgbmV4dENvbmZpZ091dHB1dCxcbiAgICB1c2VybGFuZFxufSk7XG4vLyBQdWxsIG91dCB0aGUgZXhwb3J0cyB0aGF0IHdlIG5lZWQgdG8gZXhwb3NlIGZyb20gdGhlIG1vZHVsZS4gVGhpcyBzaG91bGRcbi8vIGJlIGVsaW1pbmF0ZWQgd2hlbiB3ZSd2ZSBtb3ZlZCB0aGUgb3RoZXIgcm91dGVzIHRvIHRoZSBuZXcgZm9ybWF0LiBUaGVzZVxuLy8gYXJlIHVzZWQgdG8gaG9vayBpbnRvIHRoZSByb3V0ZS5cbmNvbnN0IHsgcmVxdWVzdEFzeW5jU3RvcmFnZSwgc3RhdGljR2VuZXJhdGlvbkFzeW5jU3RvcmFnZSwgc2VydmVySG9va3MgfSA9IHJvdXRlTW9kdWxlO1xuY29uc3Qgb3JpZ2luYWxQYXRobmFtZSA9IFwiL2FwaS9wcm9maWxlcy9baWRdL2ZvbGxvdy9yb3V0ZVwiO1xuZnVuY3Rpb24gcGF0Y2hGZXRjaCgpIHtcbiAgICByZXR1cm4gX3BhdGNoRmV0Y2goe1xuICAgICAgICBzZXJ2ZXJIb29rcyxcbiAgICAgICAgc3RhdGljR2VuZXJhdGlvbkFzeW5jU3RvcmFnZVxuICAgIH0pO1xufVxuZXhwb3J0IHsgcm91dGVNb2R1bGUsIHJlcXVlc3RBc3luY1N0b3JhZ2UsIHN0YXRpY0dlbmVyYXRpb25Bc3luY1N0b3JhZ2UsIHNlcnZlckhvb2tzLCBvcmlnaW5hbFBhdGhuYW1lLCBwYXRjaEZldGNoLCAgfTtcblxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YXBwLXJvdXRlLmpzLm1hcCJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fprofiles%2F%5Bid%5D%2Ffollow%2Froute&page=%2Fapi%2Fprofiles%2F%5Bid%5D%2Ffollow%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fprofiles%2F%5Bid%5D%2Ffollow%2Froute.ts&appDir=C%3A%5CUsers%5Cmutir%5COneDrive%5CDesktop%5Cmari%5Cguide%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5Cmutir%5COneDrive%5CDesktop%5Cmari%5Cguide&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./app/api/profiles/[id]/follow/route.ts":
/*!***********************************************!*\
  !*** ./app/api/profiles/[id]/follow/route.ts ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   DELETE: () => (/* binding */ DELETE),\n/* harmony export */   POST: () => (/* binding */ POST)\n/* harmony export */ });\n/* harmony import */ var next_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/server */ \"(rsc)/./node_modules/next/dist/api/server.js\");\n/* harmony import */ var next_auth_next__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next-auth/next */ \"(rsc)/./node_modules/next-auth/next/index.js\");\n/* harmony import */ var _lib_auth__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @/lib/auth */ \"(rsc)/./lib/auth.ts\");\n/* harmony import */ var _lib_prisma__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @/lib/prisma */ \"(rsc)/./lib/prisma.ts\");\n/* eslint-disable @typescript-eslint/no-explicit-any */ \n\n\n\nasync function resolveUserId(idOrHandle) {\n    // try to find by id first\n    const u = await _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.user.findUnique({\n        where: {\n            id: idOrHandle\n        }\n    });\n    if (u) return u.id;\n    const profile = await _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.profile.findUnique({\n        where: {\n            handle: idOrHandle\n        }\n    });\n    return profile?.userId || null;\n}\nasync function POST(req, { params }) {\n    try {\n        const session = await (0,next_auth_next__WEBPACK_IMPORTED_MODULE_1__.getServerSession)(_lib_auth__WEBPACK_IMPORTED_MODULE_2__.authOptions);\n        const userId = session?.user?.id;\n        if (!userId) return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: \"Unauthorized\"\n        }, {\n            status: 401\n        });\n        const targetIdentifier = params.id;\n        const targetId = await resolveUserId(targetIdentifier);\n        if (!targetId) return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: \"Target not found\"\n        }, {\n            status: 404\n        });\n        if (targetId === userId) return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: \"Cannot follow yourself\"\n        }, {\n            status: 400\n        });\n        // create follow (unique constraint prevents duplicates)\n        // NOTE: `follow` model requires applying the Prisma migration (DB) before this will work at runtime.\n        try {\n            const follow = await _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.follow.create({\n                data: {\n                    followerId: userId,\n                    targetId\n                }\n            });\n            const followersCount = await _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.follow.count({\n                where: {\n                    targetId\n                }\n            });\n            return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n                follow,\n                followers_count: followersCount\n            });\n        } catch (e) {\n            // if already following, return existing follow and current count\n            if (e?.code === \"P2002\") {\n                const existing = await _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.follow.findFirst({\n                    where: {\n                        followerId: userId,\n                        targetId\n                    }\n                });\n                const followersCount = await _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.follow.count({\n                    where: {\n                        targetId\n                    }\n                });\n                return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n                    follow: existing,\n                    followers_count: followersCount\n                });\n            }\n            console.error(e);\n            return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n                error: \"Server error\"\n            }, {\n                status: 500\n            });\n        }\n    } catch (err) {\n        console.error(err);\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: \"Server error\"\n        }, {\n            status: 500\n        });\n    }\n}\nasync function DELETE(req, { params }) {\n    try {\n        const session = await (0,next_auth_next__WEBPACK_IMPORTED_MODULE_1__.getServerSession)(_lib_auth__WEBPACK_IMPORTED_MODULE_2__.authOptions);\n        const userId = session?.user?.id;\n        if (!userId) return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: \"Unauthorized\"\n        }, {\n            status: 401\n        });\n        const targetIdentifier = params.id;\n        const targetId = await resolveUserId(targetIdentifier);\n        if (!targetId) return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: \"Target not found\"\n        }, {\n            status: 404\n        });\n        // NOTE: requires DB migration before runtime will succeed\n        const deleted = await _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.follow.deleteMany({\n            where: {\n                followerId: userId,\n                targetId\n            }\n        });\n        const followersCount = await _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.follow.count({\n            where: {\n                targetId\n            }\n        });\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            deleted: deleted.count,\n            followers_count: followersCount\n        });\n    } catch (err) {\n        console.error(err);\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: \"Server error\"\n        }, {\n            status: 500\n        });\n    }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9hcHAvYXBpL3Byb2ZpbGVzL1tpZF0vZm9sbG93L3JvdXRlLnRzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLHFEQUFxRCxHQUNYO0FBQ087QUFDVDtBQUNIO0FBRXJDLGVBQWVJLGNBQWNDLFVBQWtCO0lBQzdDLDBCQUEwQjtJQUMxQixNQUFNQyxJQUFJLE1BQU1ILCtDQUFNQSxDQUFDSSxJQUFJLENBQUNDLFVBQVUsQ0FBQztRQUFFQyxPQUFPO1lBQUVDLElBQUlMO1FBQVc7SUFBRTtJQUNuRSxJQUFJQyxHQUFHLE9BQU9BLEVBQUVJLEVBQUU7SUFDbEIsTUFBTUMsVUFBVSxNQUFNUiwrQ0FBTUEsQ0FBQ1EsT0FBTyxDQUFDSCxVQUFVLENBQUM7UUFBRUMsT0FBTztZQUFFRyxRQUFRUDtRQUFXO0lBQUU7SUFDaEYsT0FBT00sU0FBU0UsVUFBVTtBQUM1QjtBQUVPLGVBQWVDLEtBQUtDLEdBQVksRUFBRSxFQUFFQyxNQUFNLEVBQThCO0lBQzdFLElBQUk7UUFDRixNQUFNQyxVQUFVLE1BQU1oQixnRUFBZ0JBLENBQUNDLGtEQUFXQTtRQUNsRCxNQUFNVyxTQUFVSSxTQUFTVixNQUFxQ0c7UUFDOUQsSUFBSSxDQUFDRyxRQUFRLE9BQU9iLHFEQUFZQSxDQUFDa0IsSUFBSSxDQUFDO1lBQUVDLE9BQU87UUFBZSxHQUFHO1lBQUVDLFFBQVE7UUFBSTtRQUUvRSxNQUFNQyxtQkFBbUJMLE9BQU9OLEVBQUU7UUFDbEMsTUFBTVksV0FBVyxNQUFNbEIsY0FBY2lCO1FBQ3JDLElBQUksQ0FBQ0MsVUFBVSxPQUFPdEIscURBQVlBLENBQUNrQixJQUFJLENBQUM7WUFBRUMsT0FBTztRQUFtQixHQUFHO1lBQUVDLFFBQVE7UUFBSTtRQUVyRixJQUFJRSxhQUFhVCxRQUFRLE9BQU9iLHFEQUFZQSxDQUFDa0IsSUFBSSxDQUFDO1lBQUVDLE9BQU87UUFBeUIsR0FBRztZQUFFQyxRQUFRO1FBQUk7UUFFckcsd0RBQXdEO1FBQ3hELHFHQUFxRztRQUNyRyxJQUFJO1lBQ0YsTUFBTUcsU0FBUyxNQUFNcEIsK0NBQU1BLENBQUNvQixNQUFNLENBQUNDLE1BQU0sQ0FBQztnQkFBRUMsTUFBTTtvQkFBRUMsWUFBWWI7b0JBQVFTO2dCQUFTO1lBQUU7WUFDbkYsTUFBTUssaUJBQWlCLE1BQU14QiwrQ0FBTUEsQ0FBQ29CLE1BQU0sQ0FBQ0ssS0FBSyxDQUFDO2dCQUFFbkIsT0FBTztvQkFBRWE7Z0JBQVM7WUFBRTtZQUN2RSxPQUFPdEIscURBQVlBLENBQUNrQixJQUFJLENBQUM7Z0JBQUVLO2dCQUFRTSxpQkFBaUJGO1lBQWU7UUFDckUsRUFBRSxPQUFPRyxHQUFRO1lBQ2YsaUVBQWlFO1lBQ2pFLElBQUlBLEdBQUdDLFNBQVMsU0FBUztnQkFDdkIsTUFBTUMsV0FBVyxNQUFNN0IsK0NBQU1BLENBQUNvQixNQUFNLENBQUNVLFNBQVMsQ0FBQztvQkFBRXhCLE9BQU87d0JBQUVpQixZQUFZYjt3QkFBUVM7b0JBQVM7Z0JBQUU7Z0JBQ3pGLE1BQU1LLGlCQUFpQixNQUFNeEIsK0NBQU1BLENBQUNvQixNQUFNLENBQUNLLEtBQUssQ0FBQztvQkFBRW5CLE9BQU87d0JBQUVhO29CQUFTO2dCQUFFO2dCQUN2RSxPQUFPdEIscURBQVlBLENBQUNrQixJQUFJLENBQUM7b0JBQUVLLFFBQVFTO29CQUFVSCxpQkFBaUJGO2dCQUFlO1lBQy9FO1lBQ0FPLFFBQVFmLEtBQUssQ0FBQ1c7WUFDZCxPQUFPOUIscURBQVlBLENBQUNrQixJQUFJLENBQUM7Z0JBQUVDLE9BQU87WUFBZSxHQUFHO2dCQUFFQyxRQUFRO1lBQUk7UUFDcEU7SUFDRixFQUFFLE9BQU9lLEtBQUs7UUFDWkQsUUFBUWYsS0FBSyxDQUFDZ0I7UUFDZCxPQUFPbkMscURBQVlBLENBQUNrQixJQUFJLENBQUM7WUFBRUMsT0FBTztRQUFlLEdBQUc7WUFBRUMsUUFBUTtRQUFJO0lBQ3BFO0FBQ0Y7QUFFTyxlQUFlZ0IsT0FBT3JCLEdBQVksRUFBRSxFQUFFQyxNQUFNLEVBQThCO0lBQy9FLElBQUk7UUFDRixNQUFNQyxVQUFVLE1BQU1oQixnRUFBZ0JBLENBQUNDLGtEQUFXQTtRQUNsRCxNQUFNVyxTQUFVSSxTQUFTVixNQUFxQ0c7UUFDOUQsSUFBSSxDQUFDRyxRQUFRLE9BQU9iLHFEQUFZQSxDQUFDa0IsSUFBSSxDQUFDO1lBQUVDLE9BQU87UUFBZSxHQUFHO1lBQUVDLFFBQVE7UUFBSTtRQUUvRSxNQUFNQyxtQkFBbUJMLE9BQU9OLEVBQUU7UUFDbEMsTUFBTVksV0FBVyxNQUFNbEIsY0FBY2lCO1FBQ3JDLElBQUksQ0FBQ0MsVUFBVSxPQUFPdEIscURBQVlBLENBQUNrQixJQUFJLENBQUM7WUFBRUMsT0FBTztRQUFtQixHQUFHO1lBQUVDLFFBQVE7UUFBSTtRQUVyRiwwREFBMEQ7UUFDMUQsTUFBTWlCLFVBQVUsTUFBTWxDLCtDQUFNQSxDQUFDb0IsTUFBTSxDQUFDZSxVQUFVLENBQUM7WUFBRTdCLE9BQU87Z0JBQUVpQixZQUFZYjtnQkFBUVM7WUFBUztRQUFFO1FBQ3pGLE1BQU1LLGlCQUFpQixNQUFNeEIsK0NBQU1BLENBQUNvQixNQUFNLENBQUNLLEtBQUssQ0FBQztZQUFFbkIsT0FBTztnQkFBRWE7WUFBUztRQUFFO1FBQ3ZFLE9BQU90QixxREFBWUEsQ0FBQ2tCLElBQUksQ0FBQztZQUFFbUIsU0FBU0EsUUFBUVQsS0FBSztZQUFFQyxpQkFBaUJGO1FBQWU7SUFDckYsRUFBRSxPQUFPUSxLQUFLO1FBQ1pELFFBQVFmLEtBQUssQ0FBQ2dCO1FBQ2QsT0FBT25DLHFEQUFZQSxDQUFDa0IsSUFBSSxDQUFDO1lBQUVDLE9BQU87UUFBZSxHQUFHO1lBQUVDLFFBQVE7UUFBSTtJQUNwRTtBQUNGIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vbGFyYXZlbC10by1uZXh0anMtbWlncmF0aW9uLy4vYXBwL2FwaS9wcm9maWxlcy9baWRdL2ZvbGxvdy9yb3V0ZS50cz81MjA3Il0sInNvdXJjZXNDb250ZW50IjpbIi8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnkgKi9cclxuaW1wb3J0IHsgTmV4dFJlc3BvbnNlIH0gZnJvbSAnbmV4dC9zZXJ2ZXInXHJcbmltcG9ydCB7IGdldFNlcnZlclNlc3Npb24gfSBmcm9tICduZXh0LWF1dGgvbmV4dCdcclxuaW1wb3J0IHsgYXV0aE9wdGlvbnMgfSBmcm9tICdAL2xpYi9hdXRoJ1xyXG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tICdAL2xpYi9wcmlzbWEnXHJcblxyXG5hc3luYyBmdW5jdGlvbiByZXNvbHZlVXNlcklkKGlkT3JIYW5kbGU6IHN0cmluZykge1xyXG4gIC8vIHRyeSB0byBmaW5kIGJ5IGlkIGZpcnN0XHJcbiAgY29uc3QgdSA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZDogaWRPckhhbmRsZSB9IH0pXHJcbiAgaWYgKHUpIHJldHVybiB1LmlkXHJcbiAgY29uc3QgcHJvZmlsZSA9IGF3YWl0IHByaXNtYS5wcm9maWxlLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBoYW5kbGU6IGlkT3JIYW5kbGUgfSB9KVxyXG4gIHJldHVybiBwcm9maWxlPy51c2VySWQgfHwgbnVsbFxyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gUE9TVChyZXE6IFJlcXVlc3QsIHsgcGFyYW1zIH06IHsgcGFyYW1zOiB7IGlkOiBzdHJpbmcgfSB9KSB7XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBnZXRTZXJ2ZXJTZXNzaW9uKGF1dGhPcHRpb25zKVxyXG4gICAgY29uc3QgdXNlcklkID0gKHNlc3Npb24/LnVzZXIgYXMgdW5rbm93biBhcyB7IGlkPzogc3RyaW5nIH0pPy5pZFxyXG4gICAgaWYgKCF1c2VySWQpIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGVycm9yOiAnVW5hdXRob3JpemVkJyB9LCB7IHN0YXR1czogNDAxIH0pXHJcblxyXG4gICAgY29uc3QgdGFyZ2V0SWRlbnRpZmllciA9IHBhcmFtcy5pZFxyXG4gICAgY29uc3QgdGFyZ2V0SWQgPSBhd2FpdCByZXNvbHZlVXNlcklkKHRhcmdldElkZW50aWZpZXIpXHJcbiAgICBpZiAoIXRhcmdldElkKSByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oeyBlcnJvcjogJ1RhcmdldCBub3QgZm91bmQnIH0sIHsgc3RhdHVzOiA0MDQgfSlcclxuXHJcbiAgICBpZiAodGFyZ2V0SWQgPT09IHVzZXJJZCkgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgZXJyb3I6ICdDYW5ub3QgZm9sbG93IHlvdXJzZWxmJyB9LCB7IHN0YXR1czogNDAwIH0pXHJcblxyXG4gICAgLy8gY3JlYXRlIGZvbGxvdyAodW5pcXVlIGNvbnN0cmFpbnQgcHJldmVudHMgZHVwbGljYXRlcylcclxuICAgIC8vIE5PVEU6IGBmb2xsb3dgIG1vZGVsIHJlcXVpcmVzIGFwcGx5aW5nIHRoZSBQcmlzbWEgbWlncmF0aW9uIChEQikgYmVmb3JlIHRoaXMgd2lsbCB3b3JrIGF0IHJ1bnRpbWUuXHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBmb2xsb3cgPSBhd2FpdCBwcmlzbWEuZm9sbG93LmNyZWF0ZSh7IGRhdGE6IHsgZm9sbG93ZXJJZDogdXNlcklkLCB0YXJnZXRJZCB9IH0pXHJcbiAgICAgIGNvbnN0IGZvbGxvd2Vyc0NvdW50ID0gYXdhaXQgcHJpc21hLmZvbGxvdy5jb3VudCh7IHdoZXJlOiB7IHRhcmdldElkIH0gfSlcclxuICAgICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgZm9sbG93LCBmb2xsb3dlcnNfY291bnQ6IGZvbGxvd2Vyc0NvdW50IH0pXHJcbiAgICB9IGNhdGNoIChlOiBhbnkpIHtcclxuICAgICAgLy8gaWYgYWxyZWFkeSBmb2xsb3dpbmcsIHJldHVybiBleGlzdGluZyBmb2xsb3cgYW5kIGN1cnJlbnQgY291bnRcclxuICAgICAgaWYgKGU/LmNvZGUgPT09ICdQMjAwMicpIHtcclxuICAgICAgICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHByaXNtYS5mb2xsb3cuZmluZEZpcnN0KHsgd2hlcmU6IHsgZm9sbG93ZXJJZDogdXNlcklkLCB0YXJnZXRJZCB9IH0pXHJcbiAgICAgICAgY29uc3QgZm9sbG93ZXJzQ291bnQgPSBhd2FpdCBwcmlzbWEuZm9sbG93LmNvdW50KHsgd2hlcmU6IHsgdGFyZ2V0SWQgfSB9KVxyXG4gICAgICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGZvbGxvdzogZXhpc3RpbmcsIGZvbGxvd2Vyc19jb3VudDogZm9sbG93ZXJzQ291bnQgfSlcclxuICAgICAgfVxyXG4gICAgICBjb25zb2xlLmVycm9yKGUpXHJcbiAgICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGVycm9yOiAnU2VydmVyIGVycm9yJyB9LCB7IHN0YXR1czogNTAwIH0pXHJcbiAgICB9XHJcbiAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICBjb25zb2xlLmVycm9yKGVycilcclxuICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGVycm9yOiAnU2VydmVyIGVycm9yJyB9LCB7IHN0YXR1czogNTAwIH0pXHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gREVMRVRFKHJlcTogUmVxdWVzdCwgeyBwYXJhbXMgfTogeyBwYXJhbXM6IHsgaWQ6IHN0cmluZyB9IH0pIHtcclxuICB0cnkge1xyXG4gICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IGdldFNlcnZlclNlc3Npb24oYXV0aE9wdGlvbnMpXHJcbiAgICBjb25zdCB1c2VySWQgPSAoc2Vzc2lvbj8udXNlciBhcyB1bmtub3duIGFzIHsgaWQ/OiBzdHJpbmcgfSk/LmlkXHJcbiAgICBpZiAoIXVzZXJJZCkgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgZXJyb3I6ICdVbmF1dGhvcml6ZWQnIH0sIHsgc3RhdHVzOiA0MDEgfSlcclxuXHJcbiAgICBjb25zdCB0YXJnZXRJZGVudGlmaWVyID0gcGFyYW1zLmlkXHJcbiAgICBjb25zdCB0YXJnZXRJZCA9IGF3YWl0IHJlc29sdmVVc2VySWQodGFyZ2V0SWRlbnRpZmllcilcclxuICAgIGlmICghdGFyZ2V0SWQpIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGVycm9yOiAnVGFyZ2V0IG5vdCBmb3VuZCcgfSwgeyBzdGF0dXM6IDQwNCB9KVxyXG5cclxuICAgIC8vIE5PVEU6IHJlcXVpcmVzIERCIG1pZ3JhdGlvbiBiZWZvcmUgcnVudGltZSB3aWxsIHN1Y2NlZWRcclxuICAgIGNvbnN0IGRlbGV0ZWQgPSBhd2FpdCBwcmlzbWEuZm9sbG93LmRlbGV0ZU1hbnkoeyB3aGVyZTogeyBmb2xsb3dlcklkOiB1c2VySWQsIHRhcmdldElkIH0gfSlcclxuICAgIGNvbnN0IGZvbGxvd2Vyc0NvdW50ID0gYXdhaXQgcHJpc21hLmZvbGxvdy5jb3VudCh7IHdoZXJlOiB7IHRhcmdldElkIH0gfSlcclxuICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGRlbGV0ZWQ6IGRlbGV0ZWQuY291bnQsIGZvbGxvd2Vyc19jb3VudDogZm9sbG93ZXJzQ291bnQgfSlcclxuICB9IGNhdGNoIChlcnIpIHtcclxuICAgIGNvbnNvbGUuZXJyb3IoZXJyKVxyXG4gICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgZXJyb3I6ICdTZXJ2ZXIgZXJyb3InIH0sIHsgc3RhdHVzOiA1MDAgfSlcclxuICB9XHJcbn1cclxuIl0sIm5hbWVzIjpbIk5leHRSZXNwb25zZSIsImdldFNlcnZlclNlc3Npb24iLCJhdXRoT3B0aW9ucyIsInByaXNtYSIsInJlc29sdmVVc2VySWQiLCJpZE9ySGFuZGxlIiwidSIsInVzZXIiLCJmaW5kVW5pcXVlIiwid2hlcmUiLCJpZCIsInByb2ZpbGUiLCJoYW5kbGUiLCJ1c2VySWQiLCJQT1NUIiwicmVxIiwicGFyYW1zIiwic2Vzc2lvbiIsImpzb24iLCJlcnJvciIsInN0YXR1cyIsInRhcmdldElkZW50aWZpZXIiLCJ0YXJnZXRJZCIsImZvbGxvdyIsImNyZWF0ZSIsImRhdGEiLCJmb2xsb3dlcklkIiwiZm9sbG93ZXJzQ291bnQiLCJjb3VudCIsImZvbGxvd2Vyc19jb3VudCIsImUiLCJjb2RlIiwiZXhpc3RpbmciLCJmaW5kRmlyc3QiLCJjb25zb2xlIiwiZXJyIiwiREVMRVRFIiwiZGVsZXRlZCIsImRlbGV0ZU1hbnkiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./app/api/profiles/[id]/follow/route.ts\n");

/***/ }),

/***/ "(rsc)/./lib/auth.ts":
/*!*********************!*\
  !*** ./lib/auth.ts ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   authOptions: () => (/* binding */ authOptions)\n/* harmony export */ });\n/* harmony import */ var next_auth_providers_credentials__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next-auth/providers/credentials */ \"(rsc)/./node_modules/next-auth/providers/credentials.js\");\n/* harmony import */ var bcryptjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! bcryptjs */ \"(rsc)/./node_modules/bcryptjs/index.js\");\n/* harmony import */ var bcryptjs__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(bcryptjs__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _next_auth_prisma_adapter__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @next-auth/prisma-adapter */ \"(rsc)/./node_modules/@next-auth/prisma-adapter/dist/index.js\");\n/* harmony import */ var _lib_prisma__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @/lib/prisma */ \"(rsc)/./lib/prisma.ts\");\n\n\n\n\nconst authOptions = {\n    adapter: (0,_next_auth_prisma_adapter__WEBPACK_IMPORTED_MODULE_2__.PrismaAdapter)(_lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma),\n    providers: [\n        (0,next_auth_providers_credentials__WEBPACK_IMPORTED_MODULE_0__[\"default\"])({\n            name: \"Credentials\",\n            credentials: {\n                email: {\n                    label: \"Email\",\n                    type: \"email\"\n                },\n                password: {\n                    label: \"Password\",\n                    type: \"password\"\n                }\n            },\n            async authorize (credentials) {\n                if (!credentials?.email || !credentials?.password) {\n                    throw new Error(\"Email and password required\");\n                }\n                const user = await _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.user.findUnique({\n                    where: {\n                        email: credentials.email\n                    }\n                });\n                if (!user || !user.password) {\n                    throw new Error(\"Invalid credentials\");\n                }\n                const isPasswordValid = await bcryptjs__WEBPACK_IMPORTED_MODULE_1___default().compare(credentials.password, user.password);\n                if (!isPasswordValid) {\n                    throw new Error(\"Invalid credentials\");\n                }\n                return {\n                    id: user.id,\n                    email: user.email,\n                    name: user.name,\n                    image: user.image\n                };\n            }\n        })\n    ],\n    callbacks: {\n        async jwt ({ token, user }) {\n            if (user) {\n                token.id = user.id;\n            }\n            return token;\n        },\n        async session ({ session, token }) {\n            if (session.user) {\n                session.user.id = token.id;\n            }\n            return session;\n        }\n    },\n    pages: {\n        signIn: \"/auth/signin\",\n        error: \"/auth/error\"\n    },\n    session: {\n        strategy: \"jwt\",\n        maxAge: 30 * 24 * 60 * 60\n    },\n    events: {\n        async signIn ({ user }) {\n            try {\n                await _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.user.update({\n                    where: {\n                        id: user.id\n                    },\n                    data: {\n                        lastLogin: new Date()\n                    }\n                });\n            } catch (err) {\n                console.error(\"Failed updating lastLogin\", err);\n            }\n        }\n    },\n    secret: process.env.NEXTAUTH_SECRET\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9saWIvYXV0aC50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFDaUU7QUFDcEM7QUFDNEI7QUFDcEI7QUFFOUIsTUFBTUksY0FBK0I7SUFDMUNDLFNBQVNILHdFQUFhQSxDQUFDQywrQ0FBTUE7SUFDN0JHLFdBQVc7UUFDVE4sMkVBQW1CQSxDQUFDO1lBQ2xCTyxNQUFNO1lBQ05DLGFBQWE7Z0JBQ1hDLE9BQU87b0JBQUVDLE9BQU87b0JBQVNDLE1BQU07Z0JBQVE7Z0JBQ3ZDQyxVQUFVO29CQUFFRixPQUFPO29CQUFZQyxNQUFNO2dCQUFXO1lBQ2xEO1lBQ0EsTUFBTUUsV0FBVUwsV0FBVztnQkFDekIsSUFBSSxDQUFDQSxhQUFhQyxTQUFTLENBQUNELGFBQWFJLFVBQVU7b0JBQ2pELE1BQU0sSUFBSUUsTUFBTTtnQkFDbEI7Z0JBRUEsTUFBTUMsT0FBTyxNQUFNWiwrQ0FBTUEsQ0FBQ1ksSUFBSSxDQUFDQyxVQUFVLENBQUM7b0JBQ3hDQyxPQUFPO3dCQUFFUixPQUFPRCxZQUFZQyxLQUFLO29CQUFDO2dCQUNwQztnQkFFQSxJQUFJLENBQUNNLFFBQVEsQ0FBQ0EsS0FBS0gsUUFBUSxFQUFFO29CQUMzQixNQUFNLElBQUlFLE1BQU07Z0JBQ2xCO2dCQUVBLE1BQU1JLGtCQUFrQixNQUFNakIsdURBQWMsQ0FDMUNPLFlBQVlJLFFBQVEsRUFDcEJHLEtBQUtILFFBQVE7Z0JBR2YsSUFBSSxDQUFDTSxpQkFBaUI7b0JBQ3BCLE1BQU0sSUFBSUosTUFBTTtnQkFDbEI7Z0JBRUEsT0FBTztvQkFDTE0sSUFBSUwsS0FBS0ssRUFBRTtvQkFDWFgsT0FBT00sS0FBS04sS0FBSztvQkFDakJGLE1BQU1RLEtBQUtSLElBQUk7b0JBQ2ZjLE9BQU9OLEtBQUtNLEtBQUs7Z0JBQ25CO1lBQ0Y7UUFDRjtLQUNEO0lBQ0RDLFdBQVc7UUFDVCxNQUFNQyxLQUFJLEVBQUVDLEtBQUssRUFBRVQsSUFBSSxFQUFFO1lBQ3ZCLElBQUlBLE1BQU07Z0JBQ1JTLE1BQU1KLEVBQUUsR0FBR0wsS0FBS0ssRUFBRTtZQUNwQjtZQUNBLE9BQU9JO1FBQ1Q7UUFDQSxNQUFNQyxTQUFRLEVBQUVBLE9BQU8sRUFBRUQsS0FBSyxFQUFFO1lBQzlCLElBQUlDLFFBQVFWLElBQUksRUFBRTtnQkFDZFUsUUFBUVYsSUFBSSxDQUFxQkssRUFBRSxHQUFHSSxNQUFNSixFQUFFO1lBQ2xEO1lBQ0EsT0FBT0s7UUFDVDtJQUNGO0lBQ0FDLE9BQU87UUFDTEMsUUFBUTtRQUNSQyxPQUFPO0lBQ1Q7SUFDQUgsU0FBUztRQUNQSSxVQUFVO1FBQ1ZDLFFBQVEsS0FBSyxLQUFLLEtBQUs7SUFDekI7SUFDQUMsUUFBUTtRQUNOLE1BQU1KLFFBQU8sRUFBRVosSUFBSSxFQUFFO1lBQ25CLElBQUk7Z0JBQ0YsTUFBTVosK0NBQU1BLENBQUNZLElBQUksQ0FBQ2lCLE1BQU0sQ0FBQztvQkFBRWYsT0FBTzt3QkFBRUcsSUFBSUwsS0FBS0ssRUFBRTtvQkFBVztvQkFBR2EsTUFBTTt3QkFBRUMsV0FBVyxJQUFJQztvQkFBTztnQkFBRTtZQUMvRixFQUFFLE9BQU9DLEtBQUs7Z0JBQ1pDLFFBQVFULEtBQUssQ0FBQyw2QkFBNkJRO1lBQzdDO1FBQ0Y7SUFDRjtJQUNBRSxRQUFRQyxRQUFRQyxHQUFHLENBQUNDLGVBQWU7QUFDckMsRUFBQyIsInNvdXJjZXMiOlsid2VicGFjazovL2xhcmF2ZWwtdG8tbmV4dGpzLW1pZ3JhdGlvbi8uL2xpYi9hdXRoLnRzP2JmN2UiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHR5cGUgeyBOZXh0QXV0aE9wdGlvbnMgfSBmcm9tICduZXh0LWF1dGgnXHJcbmltcG9ydCBDcmVkZW50aWFsc1Byb3ZpZGVyIGZyb20gJ25leHQtYXV0aC9wcm92aWRlcnMvY3JlZGVudGlhbHMnXHJcbmltcG9ydCBiY3J5cHQgZnJvbSAnYmNyeXB0anMnXHJcbmltcG9ydCB7IFByaXNtYUFkYXB0ZXIgfSBmcm9tICdAbmV4dC1hdXRoL3ByaXNtYS1hZGFwdGVyJ1xyXG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tICdAL2xpYi9wcmlzbWEnXHJcblxyXG5leHBvcnQgY29uc3QgYXV0aE9wdGlvbnM6IE5leHRBdXRoT3B0aW9ucyA9IHtcclxuICBhZGFwdGVyOiBQcmlzbWFBZGFwdGVyKHByaXNtYSksXHJcbiAgcHJvdmlkZXJzOiBbXHJcbiAgICBDcmVkZW50aWFsc1Byb3ZpZGVyKHtcclxuICAgICAgbmFtZTogJ0NyZWRlbnRpYWxzJyxcclxuICAgICAgY3JlZGVudGlhbHM6IHtcclxuICAgICAgICBlbWFpbDogeyBsYWJlbDogJ0VtYWlsJywgdHlwZTogJ2VtYWlsJyB9LFxyXG4gICAgICAgIHBhc3N3b3JkOiB7IGxhYmVsOiAnUGFzc3dvcmQnLCB0eXBlOiAncGFzc3dvcmQnIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgIGFzeW5jIGF1dGhvcml6ZShjcmVkZW50aWFscykge1xyXG4gICAgICAgIGlmICghY3JlZGVudGlhbHM/LmVtYWlsIHx8ICFjcmVkZW50aWFscz8ucGFzc3dvcmQpIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRW1haWwgYW5kIHBhc3N3b3JkIHJlcXVpcmVkJylcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcclxuICAgICAgICAgIHdoZXJlOiB7IGVtYWlsOiBjcmVkZW50aWFscy5lbWFpbCB9LFxyXG4gICAgICAgIH0pXHJcblxyXG4gICAgICAgIGlmICghdXNlciB8fCAhdXNlci5wYXNzd29yZCkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNyZWRlbnRpYWxzJylcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGlzUGFzc3dvcmRWYWxpZCA9IGF3YWl0IGJjcnlwdC5jb21wYXJlKFxyXG4gICAgICAgICAgY3JlZGVudGlhbHMucGFzc3dvcmQsXHJcbiAgICAgICAgICB1c2VyLnBhc3N3b3JkXHJcbiAgICAgICAgKVxyXG5cclxuICAgICAgICBpZiAoIWlzUGFzc3dvcmRWYWxpZCkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNyZWRlbnRpYWxzJylcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICBpZDogdXNlci5pZCxcclxuICAgICAgICAgIGVtYWlsOiB1c2VyLmVtYWlsLFxyXG4gICAgICAgICAgbmFtZTogdXNlci5uYW1lLFxyXG4gICAgICAgICAgaW1hZ2U6IHVzZXIuaW1hZ2UsXHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgfSksXHJcbiAgXSxcclxuICBjYWxsYmFja3M6IHtcclxuICAgIGFzeW5jIGp3dCh7IHRva2VuLCB1c2VyIH0pIHtcclxuICAgICAgaWYgKHVzZXIpIHtcclxuICAgICAgICB0b2tlbi5pZCA9IHVzZXIuaWRcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gdG9rZW5cclxuICAgIH0sXHJcbiAgICBhc3luYyBzZXNzaW9uKHsgc2Vzc2lvbiwgdG9rZW4gfSkge1xyXG4gICAgICBpZiAoc2Vzc2lvbi51c2VyKSB7XHJcbiAgICAgICAgOyhzZXNzaW9uLnVzZXIgYXMgeyBpZD86IHN0cmluZyB9KS5pZCA9IHRva2VuLmlkIGFzIHN0cmluZ1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBzZXNzaW9uXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgcGFnZXM6IHtcclxuICAgIHNpZ25JbjogJy9hdXRoL3NpZ25pbicsXHJcbiAgICBlcnJvcjogJy9hdXRoL2Vycm9yJyxcclxuICB9LFxyXG4gIHNlc3Npb246IHtcclxuICAgIHN0cmF0ZWd5OiAnand0JyxcclxuICAgIG1heEFnZTogMzAgKiAyNCAqIDYwICogNjAsIC8vIDMwIGRheXNcclxuICB9LFxyXG4gIGV2ZW50czoge1xyXG4gICAgYXN5bmMgc2lnbkluKHsgdXNlciB9KSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgYXdhaXQgcHJpc21hLnVzZXIudXBkYXRlKHsgd2hlcmU6IHsgaWQ6IHVzZXIuaWQgYXMgc3RyaW5nIH0sIGRhdGE6IHsgbGFzdExvZ2luOiBuZXcgRGF0ZSgpIH0gfSlcclxuICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHVwZGF0aW5nIGxhc3RMb2dpbicsIGVycilcclxuICAgICAgfVxyXG4gICAgfSxcclxuICB9LFxyXG4gIHNlY3JldDogcHJvY2Vzcy5lbnYuTkVYVEFVVEhfU0VDUkVULFxyXG59XHJcbiJdLCJuYW1lcyI6WyJDcmVkZW50aWFsc1Byb3ZpZGVyIiwiYmNyeXB0IiwiUHJpc21hQWRhcHRlciIsInByaXNtYSIsImF1dGhPcHRpb25zIiwiYWRhcHRlciIsInByb3ZpZGVycyIsIm5hbWUiLCJjcmVkZW50aWFscyIsImVtYWlsIiwibGFiZWwiLCJ0eXBlIiwicGFzc3dvcmQiLCJhdXRob3JpemUiLCJFcnJvciIsInVzZXIiLCJmaW5kVW5pcXVlIiwid2hlcmUiLCJpc1Bhc3N3b3JkVmFsaWQiLCJjb21wYXJlIiwiaWQiLCJpbWFnZSIsImNhbGxiYWNrcyIsImp3dCIsInRva2VuIiwic2Vzc2lvbiIsInBhZ2VzIiwic2lnbkluIiwiZXJyb3IiLCJzdHJhdGVneSIsIm1heEFnZSIsImV2ZW50cyIsInVwZGF0ZSIsImRhdGEiLCJsYXN0TG9naW4iLCJEYXRlIiwiZXJyIiwiY29uc29sZSIsInNlY3JldCIsInByb2Nlc3MiLCJlbnYiLCJORVhUQVVUSF9TRUNSRVQiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./lib/auth.ts\n");

/***/ }),

/***/ "(rsc)/./lib/prisma.ts":
/*!***********************!*\
  !*** ./lib/prisma.ts ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   prisma: () => (/* binding */ prisma)\n/* harmony export */ });\n/* harmony import */ var _prisma_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @prisma/client */ \"@prisma/client\");\n/* harmony import */ var _prisma_client__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_prisma_client__WEBPACK_IMPORTED_MODULE_0__);\n\nconst globalForPrisma = global;\nconst prisma = globalForPrisma.prisma || new _prisma_client__WEBPACK_IMPORTED_MODULE_0__.PrismaClient({\n    log: [\n        \"query\"\n    ]\n});\nif (true) globalForPrisma.prisma = prisma;\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9saWIvcHJpc21hLnRzIiwibWFwcGluZ3MiOiI7Ozs7OztBQUE2QztBQUU3QyxNQUFNQyxrQkFBa0JDO0FBRWpCLE1BQU1DLFNBQ1hGLGdCQUFnQkUsTUFBTSxJQUN0QixJQUFJSCx3REFBWUEsQ0FBQztJQUNmSSxLQUFLO1FBQUM7S0FBUTtBQUNoQixHQUFFO0FBRUosSUFBSUMsSUFBeUIsRUFBY0osZ0JBQWdCRSxNQUFNLEdBQUdBIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vbGFyYXZlbC10by1uZXh0anMtbWlncmF0aW9uLy4vbGliL3ByaXNtYS50cz85ODIyIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFByaXNtYUNsaWVudCB9IGZyb20gJ0BwcmlzbWEvY2xpZW50J1xyXG5cclxuY29uc3QgZ2xvYmFsRm9yUHJpc21hID0gZ2xvYmFsIGFzIHVua25vd24gYXMgeyBwcmlzbWE6IFByaXNtYUNsaWVudCB9XHJcblxyXG5leHBvcnQgY29uc3QgcHJpc21hID1cclxuICBnbG9iYWxGb3JQcmlzbWEucHJpc21hIHx8XHJcbiAgbmV3IFByaXNtYUNsaWVudCh7XHJcbiAgICBsb2c6IFsncXVlcnknXSxcclxuICB9KVxyXG5cclxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIGdsb2JhbEZvclByaXNtYS5wcmlzbWEgPSBwcmlzbWFcclxuIl0sIm5hbWVzIjpbIlByaXNtYUNsaWVudCIsImdsb2JhbEZvclByaXNtYSIsImdsb2JhbCIsInByaXNtYSIsImxvZyIsInByb2Nlc3MiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./lib/prisma.ts\n");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next","vendor-chunks/bcryptjs","vendor-chunks/uuid","vendor-chunks/jose","vendor-chunks/next-auth","vendor-chunks/openid-client","vendor-chunks/oauth","vendor-chunks/@babel","vendor-chunks/object-hash","vendor-chunks/preact","vendor-chunks/@next-auth","vendor-chunks/preact-render-to-string","vendor-chunks/cookie","vendor-chunks/oidc-token-hash","vendor-chunks/@panva"], () => (__webpack_exec__("(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fprofiles%2F%5Bid%5D%2Ffollow%2Froute&page=%2Fapi%2Fprofiles%2F%5Bid%5D%2Ffollow%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fprofiles%2F%5Bid%5D%2Ffollow%2Froute.ts&appDir=C%3A%5CUsers%5Cmutir%5COneDrive%5CDesktop%5Cmari%5Cguide%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5Cmutir%5COneDrive%5CDesktop%5Cmari%5Cguide&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();