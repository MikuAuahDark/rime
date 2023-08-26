import { Metadata } from "./metadata.mjs"
import { TIFF_TAGS } from "./jpeg_tiff_tags.mjs"
import { readUint16 } from "./binary_manipulation.mjs"

const MARKER_INVALID = new Set([0xD9, 0xDA, 0xDB, 0xDC, 0xDD, 0xDE, 0xDF])

/**
 * @param {Uint8Array} data 
 * @param {number} offset 
 */
function isInvalidMarker(data, offset) {
	return data[offset] == 0xFF && MARKER_INVALID.has(data[offset + 1])
}

function isEXIFMarker(data, offset) {
	return data[offset] == 0xFF && data[offset + 1] == 0xE1
}

/**
 * 
 * @param  {Uint8Array[]} arrays
 */
function consolidateUint8Array(arrays) {
	let length = 0

	for (const arr of arrays) {
		length += arr.length
	}

	let result = new Uint8Array(length)
	let start = 0

	for (const arr of arrays) {
		result.set(arr, start)
		start += arr.length
	}

	return result
}

export class JPEGMetadata extends Metadata {
	/**
	 * @param {Uint8Array} file File to parse.
	 */
	constructor(file) {
		this.file = file

		// Parse
		if (!JPEGMetadata.test(file)) {
			throw new Error("Not JPEG")
		}

		this.startExifPos = 0
		this.endExifPos = 0
		let pos = 2
		let exifFound = false
		/** @type {Uint8Array[]} */
		let exifs = []

		while (true) {
			// Current `pos` is the marker, pos + 2 is the length
			if (isInvalidMarker(file, pos)) {
				break
			}

			// Length needs to be subtracted by 2
			const length = readUint16(file, pos + 2, true) - 2

			if (isEXIFMarker(file, pos)) {
				// Set EXIF marker beginning.
				if (!exifFound) {
					this.startExifPos = pos
				}

				exifFound = true
				exifs.push(file.slice(pos + 4, pos + 4 + length))
			} else if (exifFound) {
				this.endExifPos = pos
				break
			}

			pos = pos + 4 + length
		}

		if (!exifFound) {
			return
		}

		// Parse EXIF data
		const exifData = consolidateUint8Array(exifs)

		
	}

	/**
	 * @param {Uint8Array} file File to test.
	 * @returns {boolean} `true` if this class can parse this file and its metadata.
	 */
	static test(file) {
		return file[0] == 0xFF && file[1] == 0xD8
	}
}
