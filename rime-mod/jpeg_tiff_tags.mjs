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
	dest.set(id, { name: name, handler: instance })
}

/**
 * @template {typeof ShortTypeHandler|typeof LongTypeHandler} T
 * @param {T} extendsClass 
 * @param {{[key: number]: string}} values 
 * @param {string} defval
 */
function defineEnumHandler(extendsClass, values, defval = "Unknown") {
	return class extends extendsClass {
		/**
		 * @param {number[]} data
		 */
		toReadable(data) {
			return values[data[0]] ?? defval
		}
	}
}

class ExposureTimeTypeHandler extends RationalTypeHandler {
	/**
	 * @param {Fraction[]} data
	 */
	toReadable(data) {
		return `${data[0].n}/${data[0].d} seconds`
	}
}

class FNumberTypeHandler extends RationalTypeHandler {
	/**
	 * @param {Fraction[]} data
	 */
	toReadable(data) {
		const f = data[0].n / data[0].d
		return `f/${f}`
	}
}

defineTag(256, "Image Width", ShortOrLongTypeHandler)
defineTag(257, "Image Height", ShortOrLongTypeHandler)
defineTag(271, "Manufacturer", ASCIITypeHandler)
defineTag(272, "Model Name", ASCIITypeHandler)
defineTag(274, "Orientation", defineEnumHandler(ShortTypeHandler, {
	1: "Top Left",
	2: "Top Right",
	3: "Bottom Right",
	4: "Bottom Left",
	5: "Left Top",
	6: "Right Top",
	7: "Right Bottom",
	8: "Left Bottom"
}))
defineTag(282, "X Resolution", RationalTypeHandler)
defineTag(283, "Y Resolution", RationalTypeHandler)
defineTag(284, "Resolution Unit", defineEnumHandler(ShortTypeHandler, {
	1: "Relative",
	2: "Inch",
	3: "Centimeter"
}))
defineTag(305, "Software", ASCIITypeHandler)
defineTag(306, "Date Time", ASCIITypeHandler)
defineTag(0x8928, "Copyright", ASCIITypeHandler)
defineTag(0x8769, "ExifIFD", LongTypeHandler)
defineTag(0x8825, "GPSIFD", LongTypeHandler)
defineTag(0x829A, "Exposure Time", ExposureTimeTypeHandler)
defineTag(0x829D, "f-number", FNumberTypeHandler)
defineTag(0x8822, "Exposure Program", defineEnumHandler(ShortTypeHandler, {
	0: "Not Defined",
	1: "Manual",
	2: "Normal Program",
	3: "Aperture Priority",
	4: "Shutter Priority",
	5: "Creative Program (DoF)",
	6: "Action Program (fast shutter)",
	7: "Portrait Mode (close-up)",
	8: "Landscape Mode (background)"
}, "Reserved"))
