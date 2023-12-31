/// <reference lib="webworker" /> 
const CACHE_NAME = "rime-cache-v1"
// NOTE: When adding new files, add it here!
const ASSETS_TO_CACHE = [
	"./",
	"./index.html",
	"./index.mjs",
	"./rime-mod/binary_manipulation.mjs",
	"./rime-mod/error.mjs",
	"./rime-mod/jpeg_const.mjs",
	"./rime-mod/jpeg_metadata.mjs",
	"./rime-mod/jpeg_tiff_tag_type.mjs",
	"./rime-mod/jpeg_tiff_tags.mjs",
	"./rime-mod/main.mjs",
	"./rime-mod/metadata_to_csv.mjs",
	"./rime-mod/metadata.mjs",
	"https://cdn.jsdelivr.net/npm/material-components-web@14.0.0/dist/material-components-web.min.js",
	"https://cdn.jsdelivr.net/npm/material-components-web@14.0.0/dist/material-components-web.min.css"
]
const FONTS_TO_CACHE = [
	"https://fonts.googleapis.com/css2?family=Roboto&display=swap",
	"https://fonts.googleapis.com/icon?family=Material+Icons&display=swap"
]

/**@type {ServiceWorkerGlobalScope} */
const sw = self

/**
 * @param {string} path
 */
async function doCacheFont(path) {
	const result = await fetch(path)
	const text = await result.text()
	const fontResult = []

	for (const match of text.matchAll(/url\(([^)]+)\)/g)) {
		fontResult.push(match[1])
	}

	return fontResult
}

async function doCache() {
	const toBeCached = ASSETS_TO_CACHE.slice()
	const cachedFont = []

	for (const font of FONTS_TO_CACHE) {
		toBeCached.push(font)
		cachedFont.push(doCacheFont(font))
	}

	for (const fontUrls of (await Promise.all(cachedFont))) {
		toBeCached.push(...fontUrls)
	}

	const cacheSession = await caches.open(CACHE_NAME)
	await cacheSession.addAll(toBeCached.map((value) => {
		return new Request(value)
	}))
}

/**
 * 
 * @param {Request} request
 */
async function requestAndCache(request) {
	let response = null

	try {
		response = await fetch(request)
	} catch (error) {
		const cacheSession = await caches.open(CACHE_NAME)
		return await cacheSession.match(request)
	}

	if (response.ok && response.status == 200) {
		const cacheSession = await caches.open(CACHE_NAME)

		try {
			const dup = response.clone()
			await cacheSession.add(response)
			response = dup
		} catch (e) {
			console.log(e)
		}
	}

	return response
}

sw.addEventListener("install", (event) => {
	event.waitUntil(doCache())
})

sw.addEventListener("fetch", (event) => {
	event.respondWith(requestAndCache(event.request))
})
