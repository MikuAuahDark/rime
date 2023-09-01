import { Metadata } from "./metadata.mjs"
import { TIFF_TAGS } from "./jpeg_tiff_tags.mjs"
import { TagTypeHandler, RawIFDData, getElementSize, ParsedIFDData } from "./jpeg_tiff_tag_type.mjs"
import { readUint16, readUint32 } from "./binary_manipulation.mjs"
import { EXIF_IDENTIFIER, EXIF_IFD_ID, GPS_IFD_ID, INTEROP_IFD_ID, MARKER_INVALID } from "./jpeg_const.mjs"

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

function hasEXIFData(data, offset) {
	for (let i = 0; i < EXIF_IDENTIFIER.length; i++) {
		if (data[offset + i] != EXIF_IDENTIFIER[i]) {
			return false
		}
	}

	return true
}

/**
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

/**
 * @param {Uint8Array} data
 * @param {number} tiffStart
 * @param {number} ifdStart
 * @param {boolean} bigEndian
 * @param {{[key: number]: ParsedIFDData}} destParsed
 * @param {{[key: number]: RawIFDData}} destRaw
 */
function parseIFD(data, tiffStart, ifdStart, bigEndian, destParsed, destRaw, tagLookup = TIFF_TAGS) {
	const ifdLength = readUint16(data, tiffStart + ifdStart, bigEndian)

	for (let i = 0; i < ifdLength; i++) {
		const offset = 2 + i * 12 // tagID (2), tagNum (2), valueCount (4), value (4)
		const tagID = readUint16(data, ifdStart + offset, bigEndian)
		const tagDType = readUint16(data, ifdStart + offset + 2, bigEndian)
		const valueCount = readUint32(data, ifdStart + offset + 4, bigEndian)
		const elementSize = getElementSize(tagDType) * valueCount
		let valueData = undefined

		if (elementSize <= 4) {
			valueData = data.slice(ifdStart + offset + 8, ifdStart + offset + 8 + elementSize)
		} else {
			const valueOffset = readUint32(data, ifdStart + offset + 8, bigEndian)
			valueData = data.slice(tiffStart + valueOffset, tiffStart + valueOffset + elementSize)
		}

		if (tagLookup.has(tagID)) {
			const tagInfo = tagLookup.get(tagID)

			if (tagInfo.handler.accept(tagDType)) {
				destParsed[tagID] = new ParsedIFDData(tagInfo.name, tagInfo.handler, valueData)
			} else {
				destRaw[tagID] = new RawIFDData(tagDType, valueCount, valueData)
			}
		} else {
			destRaw[tagID] = new RawIFDData(tagDType, valueCount, valueData)
		}
	}

	return readUint32(data, ifdStart + 2 + ifdLength * 12, bigEndian)
}

/**
 * @param {Uint8Array} data
 * @param {number} offset
 * @param {{[key: number]: ParsedIFDData}[]} destParsed
 * @param {{[key: number]: RawIFDData}[]} destRaw
 * @return is it big endian?
 */
function parseTIFF(data, offset, destParsed, destRaw) {
	let bigEndian = false

	if (data[offset] == 77 && data[offset + 1] == 77) {
		bigEndian = true
	} else if (data[offset] != 73 || data[offset + 1] != 73) {
		throw new Error("Invalid TIFF header while parsing.")
	}

	const number42 = readUint16(data, offset + 2, bigEndian)
	if (number42 != 42) {
		throw new Error("Invalid TIFF header while parsing.")
	}

	// Time to parse IFD
	let nextIFD = readUint32(data, offset + 4, bigEndian)
	while (nextIFD != 0) {
		const newDestParsed = {}
		const newDestRaw = {}
		/* +6 for EXIF header */
		nextIFD = parseIFD(data, EXIF_IDENTIFIER.length, nextIFD, bigEndian, newDestParsed, newDestRaw)

		destParsed.push(newDestParsed)
		destRaw.push(newDestRaw)
	}

	// Return endianess
	return bigEndian
}

export class JPEGMetadata extends Metadata {
	/**
	 * @param {Uint8Array} file File to parse.
	 */
	constructor(file) {
		super(file)

		this.file = file

		// Parse
		if (!JPEGMetadata.test(file)) {
			throw new Error("Not JPEG")
		}

		this.startExifPos = 0 // including FF E1 marker
		this.endExifPos = 0
		let pos = 2
		let exifFound = false
		/** @type {Uint8Array[]} */
		let exifs = []

		// TODO: Parse FF E0
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
			throw new Error("No EXIF data present.")
		}

		// Parse EXIF data
		const exifData = consolidateUint8Array(exifs)
		window.lastExifData = exifData
		if (!hasEXIFData(exifData, 0)) {
			throw new Error("No EXIF data present.")
		}

		// The "Tiff" data is the one in IFDs
		/** @type {{[key: number]: ParsedIFDData}[]} */
		this.parsedTiffData = []
		/** @type {{[key: number]: RawIFDData}[]} */
		this.rawTiffData = []
		/** @type {{[key: number]: ParsedIFDData}} */
		this.parsedExifData = {}
		/** @type {{[key: number]: RawIFDData}} */
		this.rawExifData = {}

		// Parse TIFF
		this.bigEndian = parseTIFF(exifData, 6, this.parsedTiffData, this.rawTiffData)

		// Check EXIF IFD
		if (EXIF_IFD_ID in this.parsedTiffData[0]) {
			const exifIFDOffset = this.parsedTiffData[0][EXIF_IFD_ID].parsedData[0]
			parseIFD(exifData, EXIF_IDENTIFIER.length, exifIFDOffset, this.bigEndian, this.parsedExifData, this.rawExifData)
		}

		// TODO: GPS IFD
		if (GPS_IFD_ID in this.parsedTiffData[0]) {
			delete this.parsedExifData[0][GPS_IFD_ID]
		}

		if (INTEROP_IFD_ID in this.parsedTiffData[0]) {
			delete this.parsedExifData[0][INTEROP_IFD_ID]
		}
	}

	getMetadata() {
		/** @type {MetadataResult[]} */
		const result = []

		// Parsed TIFF IFD 0 first
		for (const [key, value] of Object.entries(this.parsedTiffData[0])) {
			result.push({
				id: key,
				name: value.name,
				value: value.toString(),
				level: 0
			})
		}

		// EXIF metadata
		for (const [key, value] of Object.entries(this.parsedExifData)) {
			result.push({
				id: key,
				name: value.name,
				value: value.toString(),
				level: 2
			})
		}

		return result
	}

	/**
	 * @param {Uint8Array} file File to test.
	 * @returns {boolean} `true` if this class can parse this file and its metadata.
	 */
	static test(file) {
		return file.length >= 2 && file[0] == 0xFF && file[1] == 0xD8
	}
}
