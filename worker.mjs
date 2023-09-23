const CACHE_NAME = "rime-cache-v1"
// NOTE: When adding new files, add it here!
const ASSETS_TO_CACHE = [
	"./",
	"./index.html",
	"./index.mjs",
	"./rime-mod/binary_manipulation.mjs",
	"./rime-mod/fraction.mjs",
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

	for (const font of FONTS_TO_CACHE) {
		const fontFiles = await doCacheFont(font)
		toBeCached.push(font, ...fontFiles)
	}

	const cacheSession = await caches.open(CACHE_NAME)
	await cacheSession.addAll(toBeCached.map((value) => {
		return new Request(value)
	}))
}

self.addEventListener("install", (event) => {
	event.waitUntil(doCache())
})
