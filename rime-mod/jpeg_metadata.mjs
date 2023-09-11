import { Metadata, MetadataResult } from "./metadata.mjs"
import { TIFF_TAGS } from "./jpeg_tiff_tags.mjs"
import { RawIFDData, getElementSize, ParsedIFDData, TIFF_LONG } from "./jpeg_tiff_tag_type.mjs"
import { readUint16, readUint32, writeUint16, writeUint32 } from "./binary_manipulation.mjs"
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
	const baseOff = tiffStart + ifdStart + 2

	for (let i = 0; i < ifdLength; i++) {
		const offset = i * 12 // tagID (2), tagNum (2), valueCount (4), value (4)
		const tagID = readUint16(data, baseOff + offset, bigEndian)
		const tagDType = readUint16(data, baseOff + offset + 2, bigEndian)
		const valueCount = readUint32(data, baseOff + offset + 4, bigEndian)
		const elementSize = getElementSize(tagDType) * valueCount
		let valueData = undefined

		if (elementSize <= 4) {
			valueData = data.slice(baseOff + offset + 8, baseOff + offset + 8 + elementSize)
		} else {
			const valueOffset = readUint32(data, baseOff + offset + 8, bigEndian)
			valueData = data.slice(tiffStart + valueOffset, tiffStart + valueOffset + elementSize)
		}

		if (tagLookup.has(tagID)) {
			const tagInfo = tagLookup.get(tagID)

			if (tagInfo.handler.accept(tagDType)) {
				destParsed[tagID] = new ParsedIFDData(tagInfo, tagDType, bigEndian, valueCount, valueData)
			} else {
				destRaw[tagID] = new RawIFDData(tagDType, valueCount, valueData)
			}
		} else {
			destRaw[tagID] = new RawIFDData(tagDType, valueCount, valueData)
		}
	}

	return readUint32(data, baseOff + ifdLength * 12, bigEndian)
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

		if (this.parsedTiffData.length == 0 || Object.keys(this.parsedTiffData[0]).length == 0) {
			throw new Error("No EXIF data present.")
		}

		// Check EXIF IFD
		if (EXIF_IFD_ID in this.parsedTiffData[0]) {
			const exifIFDOffset = this.parsedTiffData[0][EXIF_IFD_ID].parsedData[0]
			parseIFD(exifData, EXIF_IDENTIFIER.length, exifIFDOffset, this.bigEndian, this.parsedExifData, this.rawExifData)
			delete this.parsedTiffData[0][EXIF_IFD_ID]
		}

		if (Object.keys(this.parsedExifData).length == 0) {
			throw new Error("No EXIF data present.")
		}

		// TODO: GPS IFD
		if (GPS_IFD_ID in this.parsedTiffData[0]) {
			delete this.parsedTiffData[0][GPS_IFD_ID]
		}

		if (INTEROP_IFD_ID in this.parsedTiffData[0]) {
			delete this.parsedTiffData[0][INTEROP_IFD_ID]
		}
	}

	getMetadata() {
		/** @type {MetadataResult[]} */
		const result = []

		// Parsed TIFF IFD 0 first
		for (const [key, value] of Object.entries(this.parsedTiffData[0])) {
			result.push(new MetadataResult(key, value.name, value.toString(), value.description, value.level))
		}

		// EXIF metadata
		for (const [key, value] of Object.entries(this.parsedExifData)) {
			result.push(new MetadataResult(key, value.name, value.toString(), value.description, value.level))
		}

		return result
	}

	/**
	 * @param {Set<string>} metadatas
	 */
	removeMetadata(metadatas) {
		// Calculate TIFF IFD sizes
		let totalAllIFD = 1 // +1 for EXIF IFD
		/** @type {number[]} */
		let totalIFD = []
		for (let i = 0; i < this.rawTiffData.length; i++) {
			let totalIFDCurrent = Number(i == 0) // +1 for EXIF IFD

			for (const [key, value] of Object.entries(this.parsedTiffData[i])) {
				const removed = (key in metadatas) && (value.level > 0)
				totalAllIFD += !removed
				totalIFDCurrent += !removed
			}

			// Unparsed is preserved by default.
			const rawIFDs = Object.keys(this.rawTiffData[i]).length
			totalAllIFD += rawIFDs
			totalIFDCurrent += rawIFDs
			totalIFD.push(totalIFDCurrent)
		}

		// Count EXIF
		let totalExifIFD = 0
		for (const [key, value] of Object.entries(this.parsedExifData)) {
			const removed = (key in metadatas) && (value.level > 0)
			totalAllIFD += !removed
			totalExifIFD += !removed
		}

		const totalTIFFIFDSize = totalAllIFD * 12 + (this.rawTiffData.length + 1) * 8

		// TIFF header
		const tiffHeader = new Uint8Array(8)
		writeUint16(tiffHeader, 0, false, this.bigEndian ? 0x4D4D : 0x4949)
		writeUint16(tiffHeader, 2, this.bigEndian, 42)
		writeUint32(tiffHeader, 4, this.bigEndian, 8) // 8 is TIFF start
		dataBuffer.push(tiffHeader)

		const tiffIFD = new Uint8Array(totalTIFFIFDSize)
		let tiffIFDOffset = 0
		/** @type Uint8Array[] */
		const tiffData = []
		let tiffDataOffset = 0

		for (let i = 0; i < this.rawTiffData.length; i++) {
			writeUint32(tiffIFD, tiffIFDOffset, this.bigEndian, totalIFD[i])
			tiffIFDOffset += 4

			for (const [key, value] of Object.entries(this.parsedTiffData[i])) {
				const removed = (key in metadatas) && (value.level > 0)

				if (!removed) {
					const encoded = value.handler.encode(this.bigEndian)
					writeUint16(tiffIFD, tiffIFDOffset, this.bigEndian, parseInt(key))
					writeUint16(tiffIFD, tiffIFDOffset + 2, this.bigEndian, encoded.type)
					writeUint32(tiffIFD, tiffIFDOffset + 4, this.bigEndian, encoded.count)

					if (encoded.buffer.length <= 4) {
						// Write to data directly
						tiffIFD.set(encoded.buffer, tiffIFDOffset + 8)
					} else {
						// Allocate tiffData
						writeUint32(tiffIFD, tiffIFDOffset + 8, this.bigEndian, tiffDataOffset + tiffHeader.length + totalTIFFIFDSize)
						tiffData.push(encoded.buffer)
						tiffDataOffset += encoded.buffer.length
					}

					tiffIFDOffset += 12
				}
			}

			// Unparsed is preserved by default.
			for (const [key, value] of Object.entries(this.rawTiffData[i])) {
				writeUint16(tiffIFD, tiffIFDOffset, this.bigEndian, parseInt(key))
				writeUint16(tiffIFD, tiffIFDOffset + 2, this.bigEndian, value.type)
				writeUint32(tiffIFD, tiffIFDOffset + 4, this.bigEndian, value.count)

				if (value.data.length <= 4) {
					// Write to data directly
					tiffIFD.set(value.data, tiffIFDOffset + 8)
				} else {
					// Allocate tiffData
					writeUint32(tiffIFD, tiffIFDOffset + 8, this.bigEndian, tiffDataOffset + tiffHeader.length + totalTIFFIFDSize)
					tiffData.push(value.data)
					tiffDataOffset += value.data.length
				}

				tiffIFDOffset += 12
			}

			// Write EXIF IFD
			if (i == 0) {
				writeUint16(tiffIFD, tiffIFDOffset, this.bigEndian, EXIF_IFD_ID)
				writeUint16(tiffIFD, tiffIFDOffset + 2, this.bigEndian, TIFF_LONG)
				writeUint32(tiffIFD, tiffIFDOffset + 4, this.bigEndian, 1)
				writeUint32(tiffIFD, tiffIFDOffset + 8, this.bigEndian, tiffDataOffset + 16) // + 12 (current IFD) + 4 (next IFD)
				tiffIFDOffset += 12
			}

			// Next IFD
			const next = (i + 1) == this.rawTiffData.length ? 0 : (tiffIFDOffset + 4)
			writeUint32(tiffIFD, tiffIFDOffset, this.bigEndian, next)
		}

		// EXIF IFD
		writeUint32(tiffIFD, tiffIFDOffset, this.bigEndian, totalExifIFD)
		tiffIFDOffset += 4
		for (const [key, value] of Object.entries(this.parsedExifData)) {
			const removed = (key in metadatas) && (value.level > 0)

			if (!removed) {
				const encoded = value.handler.encode(this.bigEndian)
				writeUint16(tiffIFD, tiffIFDOffset, this.bigEndian, parseInt(key))
				writeUint16(tiffIFD, tiffIFDOffset + 2, this.bigEndian, encoded.type)
				writeUint32(tiffIFD, tiffIFDOffset + 4, this.bigEndian, encoded.count)

				if (encoded.buffer.length <= 4) {
					// Write to data directly
					tiffIFD.set(encoded.buffer, tiffIFDOffset + 8)
				} else {
					// Allocate tiffData
					writeUint32(tiffIFD, tiffIFDOffset + 8, this.bigEndian, tiffDataOffset + tiffHeader.length + totalTIFFIFDSize)
					tiffData.push(encoded.buffer)
					tiffDataOffset += encoded.buffer.length
				}

				tiffIFDOffset += 12
			}
		}
		writeUint32(tiffIFD, tiffIFDOffset, this.bigEndian, 0)

		const app1MarkerData = consolidateUint8Array([
			tiffHeader,
			tiffIFD,
			...tiffData
		])
		const result = new Uint8Array(4 + app1MarkerData.length)

		if ((app1MarkerData.length + 2) > 65535) {
			// TODO
			throw new Error("EXIF data exceeded 64KiB")
		}

		writeUint16(result, 0, true, 0xFFE1)
		writeUint16(result, 2, true, app1MarkerData.length + 2)
		result.set(app1MarkerData, 4)

		return consolidateUint8Array([
			this.file.slice(0, this.startExifPos),
			result,
			this.file.slice(this.endExifPos)
		])
	}

	/**
	 * @param {Uint8Array} file File to test.
	 * @returns {boolean} `true` if this class can parse this file and its metadata.
	 */
	static test(file) {
		return file.length >= 2 && file[0] == 0xFF && file[1] == 0xD8
	}
}
