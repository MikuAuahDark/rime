import { JPEGMetadata } from "./jpeg_metadata.mjs"
import { Metadata } from "./metadata.mjs"

/**
 * @type {(typeof Metadata)[]}
 */
const METADATA_PARSERS = [JPEGMetadata]

/**
 * @param {Uint8Array} file
 */
export function loadMetadata(file) {
	for (const parser of METADATA_PARSERS) {
		if (parser.test(file)) {
			return new parser(file)
		}
	}

	throw new Error("File unsupported")
}
