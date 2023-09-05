import { TagTypeHandler, ByteTypeHandler, ASCIITypeHandler, ShortTypeHandler, LongTypeHandler, RationalTypeHandler, UndefinedTypeHandler, ShortOrLongTypeHandler } from "./jpeg_tiff_tag_type.mjs"

/** @type {Map<number, {name: string, handler: TagTypeHandler, level: number, info: string}>} */
export const TIFF_TAGS = new Map()
/** @type {Map<number, {name: string, handler: TagTypeHandler, level: number, info: string}>} */
export const GPS_TAGS = new Map()

/** @type {Map<typeof TagTypeHandler, TagTypeHandler>} */
const SINGLETON_INSTANCE = new Map()

/**
 * @param {number} id
 * @param {string} name
 * @param {number} level
 * @param {typeof TagTypeHandler<any>} handler
 */
function defineTag(id, name, level, handler, description = "", dest = TIFF_TAGS) {
	let instance = null
	if (!SINGLETON_INSTANCE.has(handler)) {
		instance = new handler()
		SINGLETON_INSTANCE.set(handler, instance)
	} else {
		instance = SINGLETON_INSTANCE.get(handler)
	}
	dest.set(id, { name: name, handler: instance, level: level, info: description })
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

class CopyrightTypeHandler extends ASCIITypeHandler {
	/**
	 * @param {string} data
	 */
	toReadable(data) {
		const copyright = data.split("\0")
		return copyright.join(". ")
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

class SubjectDistanceTypeHandler extends RationalTypeHandler {
	/**
	 * @param {Fraction[]} data
	 */
	toReadable(data) {
		switch (data[0].n) {
			case 0xFFFFFFFF:
				return "Infinity"
			case 0:
				return "Unknown"
			default:
				return (data[0].n / data[0].d).toString()
		}
	}
}

defineTag(256, "Image Width", 0, ShortOrLongTypeHandler, "Image width, in pixels.")
defineTag(257, "Image Height", 0, ShortOrLongTypeHandler, "Image height, in pixels.")
defineTag(271, "Manufacturer", 2, ASCIITypeHandler, "Scanner manufacturer.")
defineTag(272, "Model Name", 2, ASCIITypeHandler, "Scanner model name or number.")
defineTag(274, "Orientation", 0, defineEnumHandler(ShortTypeHandler, {
	1: "Top Left",
	2: "Top Right",
	3: "Bottom Right",
	4: "Bottom Left",
	5: "Left Top",
	6: "Right Top",
	7: "Right Bottom",
	8: "Left Bottom"
}), "Orientation of the image with respect to the rows and columns.")
defineTag(282, "X Resolution", 0, RationalTypeHandler,
	"The number of pixels per \"Resolution Unit\" in the \"Image Width\" direction."
)
defineTag(283, "Y Resolution", 0, RationalTypeHandler,
	"The number of pixels per \"Resolution Unit\" in the \"Image Height\" direction."
)
defineTag(296, "Resolution Unit", 0, defineEnumHandler(ShortTypeHandler, {
	1: "Relative",
	2: "Inch",
	3: "Centimeter"
}), "Unit of measurement for \"X Resolution\" and \"Y Resolution\".")
defineTag(305, "Software", 2, ASCIITypeHandler,
	"Name and version number of the software package(s) used to create or modify the image."
)
defineTag(306, "Date & Time", 2, ASCIITypeHandler, "Date and time of image creation or modification.")
defineTag(0x8298, "Copyright", 1, CopyrightTypeHandler, "Copyright information of the image.")
defineTag(0x8769, "ExifIFD", 0, LongTypeHandler)
defineTag(0x8825, "GPSIFD", 0, LongTypeHandler)
defineTag(0x829A, "Exposure Time", 1, ExposureTimeTypeHandler, "Exposure time, in seconds")
defineTag(0x829D, "f-number", 1, FNumberTypeHandler, "The F number")
defineTag(0x8822, "Exposure Program", 1, defineEnumHandler(ShortTypeHandler, {
	0: "Not Defined",
	1: "Manual",
	2: "Normal Program",
	3: "Aperture Priority",
	4: "Shutter Priority",
	5: "Creative Program (DoF)",
	6: "Action Program (fast shutter)",
	7: "Portrait Mode (close-up)",
	8: "Landscape Mode (background)"
}, "Reserved"), "The class of the program used by the camera to set exposure when the picture is taken.")
