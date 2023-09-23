import { Metadata, MetadataResult } from "./metadata.mjs"
import { GPS_TAGS, TIFF_TAGS } from "./jpeg_tiff_tags.mjs"
import { RawIFDData, getElementSize, ParsedIFDData, TIFF_LONG } from "./jpeg_tiff_tag_type.mjs"
import { readUint16, readUint32, writeUint16, writeUint32 } from "./binary_manipulation.mjs"
import { EXIF_IDENTIFIER, EXIF_IFD_ID, GPS_IFD_ID, INTEROP_IFD_ID, MARKER_INVALID } from "./jpeg_const.mjs"

const EXIF_HEADER = new Uint8Array(EXIF_IDENTIFIER)

/**
 * @param {Uint8Array} data 
 * @param {number} offset 
 */
function isInvalidMarker(data, offset) {
	return data[offset] == 0xFF && MARKER_INVALID.has(data[offset + 1])
}

/**
 * @param {Uint8Array} data 
 * @param {number} offset 
 */
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

/**
 * @param {Set<string>} removal
 * @param {{[key: string]: ParsedIFDData}} parsed
 * @param {{[key: string]: RawIFDData}} raw 
 */
function countWrittenIFDs(removal, parsed, raw) {
	let count = 0

	for (const [key, value] of Object.entries(parsed)) {
		const removed = (removal.has(key)) && (value.level > 0)
		count += !removed
	}

	// Unparsed is preserved by default.
	return count + Object.keys(raw).length
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
				if (exifFound) {
					this.endExifPos = pos
				}

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
		/** @type {{[key: number]: ParsedIFDData}} */
		this.parsedGPSData = {}
		/** @type {{[key: number]: RawIFDData}} */
		this.rawGPSData = {}
		this.hasGPS = false

		// Parse TIFF
		this.bigEndian = parseTIFF(exifData, 6, this.parsedTiffData, this.rawTiffData)

		if (this.parsedTiffData.length == 0 || Object.keys(this.parsedTiffData[0]).length == 0) {
			throw new Error("No EXIF data present.")
		}

		// Check EXIF IFD
		if (EXIF_IFD_ID in this.parsedTiffData[0]) {
			const exifIFDOffset = this.parsedTiffData[0][EXIF_IFD_ID].parsedData[0]
			parseIFD(
				exifData,
				EXIF_IDENTIFIER.length,
				exifIFDOffset,
				this.bigEndian,
				this.parsedExifData,
				this.rawExifData
			)
			delete this.parsedTiffData[0][EXIF_IFD_ID]
		}

		if (GPS_IFD_ID in this.parsedTiffData[0]) {
			const gpsIFDOffset = this.parsedTiffData[0][GPS_IFD_ID].parsedData[0]
			this.hasGPS = true
			parseIFD(
				exifData,
				EXIF_IDENTIFIER.length,
				gpsIFDOffset,
				this.bigEndian,
				this.parsedGPSData,
				this.rawGPSData,
				GPS_TAGS
			)
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

		// GPS EXIF metadata
		for (const [key, value] of Object.entries(this.parsedGPSData)) {
			result.push(new MetadataResult(key, value.name, value.toString(), value.description, value.level))
		}

		return result
	}

	/**
	 * @param {Set<string>} metadatas
	 */
	removeMetadata(metadatas) {
		// GPS EXIF IFD
		/** @type {Uint8Array|null} */
		let gpsIFD = null
		let totalGPSIFD = 0
		if (this.hasGPS) {
			totalGPSIFD = countWrittenIFDs(metadatas, this.parsedGPSData, this.rawGPSData) - ("0" in this.rawGPSData)

			if (totalGPSIFD > 0) {
				gpsIFD = new Uint8Array(totalGPSIFD * 12 + 6)
			}
		}

		// Calculate TIFF IFD sizes
		let totalAllIFD = 0
		/** @type {number[]} */
		let totalIFD = []
		for (let i = 0; i < this.rawTiffData.length; i++) {
			// i == 0 for EXIF IFD
			let totalIFDCurrent = (i == 0) * (1 + (this.hasGPS && totalGPSIFD > 0)) + countWrittenIFDs(
				metadatas,
				this.parsedTiffData[i],
				this.rawTiffData[i]
			)

			totalAllIFD += totalIFDCurrent
			totalIFD.push(totalIFDCurrent)
		}

		// TIFF header and IFD
		const totalTIFFIFDSize = totalAllIFD * 12 + (this.rawTiffData.length + 1) * 6
		const tiffIFD = new Uint8Array(8 + totalTIFFIFDSize)
		writeUint16(tiffIFD, 0, false, this.bigEndian ? 0x4D4D : 0x4949)
		writeUint16(tiffIFD, 2, this.bigEndian, 42)
		writeUint32(tiffIFD, 4, this.bigEndian, 8) // 8 is TIFF start
		let tiffIFDOffset = 8

		/** @type Uint8Array[] */
		const tiffData = []
		let tiffDataOffset = 0

		// EXIF IFD
		const totalExifIFD = countWrittenIFDs(metadatas, this.parsedExifData, this.rawExifData)
		const exifIFD = new Uint8Array(totalExifIFD * 12 + 6)

		/**
		 * @param {Uint8Array} buffer
		 */
		function allocateIFDData(buffer) {
			const start = tiffDataOffset
			tiffData.push(buffer)
			tiffDataOffset += buffer.length

			return start + tiffIFD.length
		}

		for (let i = 0; i < this.rawTiffData.length; i++) {
			let currentWrittenIFD = 0
			writeUint16(tiffIFD, tiffIFDOffset, this.bigEndian, totalIFD[i])
			tiffIFDOffset += 2

			for (const [key, value] of Object.entries(this.parsedTiffData[i])) {
				const removed = (metadatas.has(key)) && (value.level > 0)

				if (!removed) {
					const encoded = value.encode(this.bigEndian)
					writeUint16(tiffIFD, tiffIFDOffset, this.bigEndian, parseInt(key))
					writeUint16(tiffIFD, tiffIFDOffset + 2, this.bigEndian, encoded.type)
					writeUint32(tiffIFD, tiffIFDOffset + 4, this.bigEndian, encoded.count)

					if (encoded.buffer.length <= 4) {
						// Write to data directly
						tiffIFD.set(encoded.buffer, tiffIFDOffset + 8)
					} else {
						// Allocate tiffData
						writeUint32(
							tiffIFD,
							tiffIFDOffset + 8,
							this.bigEndian,
							allocateIFDData(encoded.buffer)
						)
					}

					currentWrittenIFD++
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
					writeUint32(
						tiffIFD,
						tiffIFDOffset + 8,
						this.bigEndian,
						allocateIFDData(value.data)
					)
				}

				currentWrittenIFD++
				tiffIFDOffset += 12
			}

			// Write EXIF IFD
			if (i == 0) {
				writeUint16(tiffIFD, tiffIFDOffset, this.bigEndian, EXIF_IFD_ID)
				writeUint16(tiffIFD, tiffIFDOffset + 2, this.bigEndian, TIFF_LONG)
				writeUint32(tiffIFD, tiffIFDOffset + 4, this.bigEndian, 1)

				writeUint32(
					tiffIFD,
					tiffIFDOffset + 8,
					this.bigEndian,
					allocateIFDData(exifIFD)
				)

				tiffIFDOffset += 12
				currentWrittenIFD++

				// Write EXIF GPS
				if (gpsIFD) {
					writeUint16(tiffIFD, tiffIFDOffset, this.bigEndian, GPS_IFD_ID)
					writeUint16(tiffIFD, tiffIFDOffset + 2, this.bigEndian, TIFF_LONG)
					writeUint32(tiffIFD, tiffIFDOffset + 4, this.bigEndian, 1)
	
					writeUint32(
						tiffIFD,
						tiffIFDOffset + 8,
						this.bigEndian,
						allocateIFDData(gpsIFD)
					)
	
					tiffIFDOffset += 12
					currentWrittenIFD++
				}
			}

			console.assert(currentWrittenIFD == totalIFD[i], new Error(`current written IFD not equal with IFD ${i}`))

			// Next IFD
			const next = (i + 1) == this.rawTiffData.length ? 0 : (tiffIFDOffset + 4)
			writeUint32(tiffIFD, tiffIFDOffset, this.bigEndian, next)
			tiffIFDOffset += 4
		}

		/**
		 * @param {Uint8Array} ifdBytes
		 * @param {boolean} bigEndian 
		 * @param {number} totalEntries 
		 * @param {{[key: string]: ParsedIFDData}} parsed 
		 * @param {{[key: string]: RawIFDData}} raw 
		 */
		function genIFD(ifdBytes, bigEndian, totalEntries, parsed, raw) {
			let ifdOffset = 0

			writeUint16(ifdBytes, 0, bigEndian, totalEntries)
			ifdOffset += 2

			for (const [key, value] of Object.entries(parsed)) {
				const removed = (metadatas.has(key)) && (value.level > 0)

				if (!removed) {
					const encoded = value.encode(bigEndian)
					writeUint16(ifdBytes, ifdOffset, bigEndian, parseInt(key))
					writeUint16(ifdBytes, ifdOffset + 2, bigEndian, encoded.type)
					writeUint32(ifdBytes, ifdOffset + 4, bigEndian, encoded.count)

					if (encoded.buffer.length <= 4) {
						// Write to data directly
						ifdBytes.set(encoded.buffer, ifdOffset + 8)
					} else {
						writeUint32(
							ifdBytes,
							ifdOffset + 8,
							bigEndian,
							allocateIFDData(encoded.buffer)
						)
					}

					ifdOffset += 12
				}
			}

			// Unparsed is preserved by default.
			for (const [key, value] of Object.entries(raw)) {
				writeUint16(ifdBytes, ifdOffset, bigEndian, parseInt(key))
				writeUint16(ifdBytes, ifdOffset + 2, bigEndian, value.type)
				writeUint32(ifdBytes, ifdOffset + 4, bigEndian, value.count)

				if (value.data.length <= 4) {
					// Write to data directly
					ifdBytes.set(value.data, ifdOffset + 8)
				} else {
					writeUint32(
						ifdBytes,
						ifdOffset + 8,
						bigEndian,
						allocateIFDData(value.data)
					)
					tiffData.push(value.data)
					tiffDataOffset += value.data.length
				}

				ifdOffset += 12
			}

			writeUint32(ifdBytes, ifdOffset, bigEndian, 0)
		}

		// EXIF IFD
		genIFD(exifIFD, this.bigEndian, totalExifIFD, this.parsedExifData, this.rawExifData)
		if (gpsIFD) {
			genIFD(gpsIFD, this.bigEndian, totalGPSIFD, this.parsedGPSData, this.rawGPSData)
		}

		const app1MarkerData = consolidateUint8Array([
			EXIF_HEADER,
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

	mimeType() {
		return "image/jpeg"
	}

	/**
	 * @param {Uint8Array} file File to test.
	 * @returns {boolean} `true` if this class can parse this file and its metadata.
	 */
	static test(file) {
		return file.length >= 2 && file[0] == 0xFF && file[1] == 0xD8
	}
}
