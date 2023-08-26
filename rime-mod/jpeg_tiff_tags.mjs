import { TagTypeHandler, ByteTypeHandler, ASCIITypeHandler, ShortTypeHandler, LongTypeHandler, RationalTypeHandler, UndefinedTypeHandler, ShortOrLongTypeHandler } from "./jpeg_tiff_tag_type.mjs"


/** @type {Map<number, {name: string, handler: TagTypeHandler}>} */
export const TIFF_TAGS = new Map()
/** @type {Map<number, {name: string, handler: TagTypeHandler}>} */
export const GPS_TAGS = new Map()

/** @type {Map<typeof TagTypeHandler, TagTypeHandler>} */
const SINGLETON_INSTANCE = new Map()

/**
 * @param {number} id
 * @param {string} name
 * @param {typeof TagTypeHandler<any>} handler
 */
function defineTag(id, name, handler, dest = TIFF_TAGS) {
	let instance = null
	if (!SINGLETON_INSTANCE.has(handler)) {
		instance = new handler()
		SINGLETON_INSTANCE.set(handler, instance)
	} else {
		instance = SINGLETON_INSTANCE.get(handler)
	}
	dest[id] = { name: name, handler: instance }
}

class OrientationTypeHandler extends ShortTypeHandler {
	/**
	 * @param {number[]} data
	 */
	toReadable(data) {
		switch (data[0]) {
			case 1:
				return "Top Left"
			case 2:
				return "Top Right"
			case 3:
				return "Bottom Right"
			case 4:
				return "Bottom Left"
			case 5:
				return "Left Top"
			case 6:
				return "Right Top"
			case 7:
				return "Right Bottom"
			case 8:
				return "Left Bottom"
			default:
				return "Unknown"
		}
	}
}

class ResolutionUnitTypeHandler extends ShortTypeHandler {
	/**
	 * @param {number[]} data
	 */
	toReadable(data) {
		switch (data[0]) {
			case 1:
				return "Relative"
			case 2:
				return "Inch"
			case 3:
				return "Centimeter"
			default:
				return "Unknown"
		}
	}
}

class ExposureTimeTypeHandler extends RationalTypeHandler {
	/**
	 * @param {Fraction[]} data
	 */
	toReadable(data) {
		const exposureTime = data[0].n / data[0].d
		return `${exposureTime} seconds`
	}
}

class FNumberTypeHandler extends RationalTypeHandler {
	/**
	 * @param {Fraction[]} data
	 */
	toReadable(data) {
		const f = data[0].n / data[0].d
		return `f/${exposureTime}`
	}
}

defineTag(256, "Image Width", ShortOrLongTypeHandler)
defineTag(257, "Image Height", ShortOrLongTypeHandler)
defineTag(271, "Manufacturer", ASCIITypeHandler)
defineTag(272, "Model Name", ASCIITypeHandler)
defineTag(274, "Orientation", OrientationTypeHandler)
defineTag(282, "X Resolution", RationalTypeHandler)
defineTag(283, "Y Resolution", RationalTypeHandler)
defineTag(284, "Resolution Unit", ResolutionUnitTypeHandler)
defineTag(305, "Software", ASCIITypeHandler)
defineTag(306, "Date Time", ASCIITypeHandler)
defineTag(0x8928, "Copyright", ASCIITypeHandler)
defineTag(0x8769, "ExifIFD", LongTypeHandler)
defineTag(0x8825, "GPSIFD", LongTypeHandler)
defineTag(0x829A, "Exposure Time", ExposureTimeTypeHandler)
defineTag(0x829D, "f-number", FNumberTypeHandler)
