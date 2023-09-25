import { FileUnsupportedError, RIMEError } from "./error.mjs"
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
	const errors = []

	for (const parser of METADATA_PARSERS) {
		if (parser.test(file)) {
			try {
				return new parser(file)
			} catch (error) {
				if (error instanceof RIMEError) {
					throw error
				} else if (error instanceof Error) {
					errors.push(error.message)
				} else {
					errors.push(error.toString())
				}
			}
		} else {
			errors.push("Not " + parser.name())
		}
	}

	throw new FileUnsupportedError(errors)
}
