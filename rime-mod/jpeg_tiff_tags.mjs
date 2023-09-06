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

/**
 * @template {typeof ShortTypeHandler|typeof LongTypeHandler} T
 * @param {T} extendsClass 
 * @param {string} unit
 */
function defineUnitHandler(extendsClass, unit) {
	return class extends extendsClass {
		/**
		 * @param {number[]} data
		 */
		toReadable(data) {
			return super.toReadable(data) + " " + unit
		}
	}
}

class CopyrightTypeHandler extends ASCIITypeHandler {
	/**
	 * @param {string} s
	 */
	static filter(s) {
		return s != " "
	}
	/**
	 * @param {string} data
	 */
	toReadable(data) {
		const copyright = data.split("\0").filter(CopyrightTypeHandler.filter)
		return copyright.join(". ")
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
				return `${data[0].n / data[0].d} meter(s)`
		}
	}
}

defineTag(256, "Image Width", 0, defineUnitHandler(ShortOrLongTypeHandler, "pixels"), "Image width, in pixels.")
defineTag(257, "Image Height", 0, defineUnitHandler(ShortOrLongTypeHandler, "pixels"), "Image height, in pixels.")
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
defineTag(0x829A, "Exposure Time", 1, defineUnitHandler(RationalTypeHandler, "second(s)"), "Exposure time, in seconds")
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
defineTag(0x8827, "Photo Sensitivity", 1, ShortTypeHandler,
	"This tag indicates the sensitivity of the camera or input device when the image was shot. More specifically, " +
	"it indicates one of the following values that are parameters defined in ISO 12232:\n" +
	"Standard Output Sensitivity (SOS)\n" +
	"Recommended Exposure Index (REI)\n" +
	"ISO speed"
)
defineTag(0x9003, "Original Date & Time", 2, ASCIITypeHandler,
	"The date and time when the original image data was generated. For a DSC (Digital Still Camera) the date and " +
	"time the picture was taken are recorded."
)
defineTag(0x9004, "Digitized Date & Time", 2, ASCIITypeHandler,
	"The date and time when the image was stored as digital data. If, for example, an image was captured by DSC " +
	"(Digital Still Camera) and at the same time the file was recorded, then the \"Original Date & Time\" and " +
	"\"Digitized Date & Time\" will have the same contents."
)
defineTag(0x9010, "Time Offset", 2, ASCIITypeHandler,
	"A tag used to record the offset from UTC (the time difference from Universal Time Coordinated including " +
	"Daylight Saving Time) of the time in the \"Date & Time\" tag."
)
defineTag(0x9011, "Original Time Offset", 2, ASCIITypeHandler,
	"A tag used to record the offset from UTC (the time difference from Universal Time Coordinated including " +
	"Daylight Saving Time) of the time in the \"Original Date & Time\" tag."
)
defineTag(0x9012, "Digitized Time Offset", 2, ASCIITypeHandler,
	"A tag used to record the offset from UTC (the time difference from Universal Time Coordinated including " +
	"Daylight Saving Time) of the time in the \"Digitized Date & Time\" tag."
)
//defineTag(0x9201, "Shutter Speed", 1, TODO)
//defineTag(0x9202, "Aperture", 1, TODO)
//defineTag(0x9203, "Brightness Value", 1, TODO)
//defineTag(0x9204, "Exposure Bias", 1, TODO)
//defineTag(0x9205, "Max Aperture", 1, TODO)
defineTag(0x9206, "Subject Distance", 1, SubjectDistanceTypeHandler,
	"The distance to the subject, in meters."
)
defineTag(0x9207, "Metering Mode", 1, defineEnumHandler(ShortTypeHandler, {
	0: "Unknown",
	1: "Average",
	2: "Center Weighted Average",
	3: "Spot",
	4: "Multi-spot",
	5: "Pattern",
	6: "Partial",
	255: "Other"
}, "Reserved"), "Metering mode.")
defineTag(0x9208, "Light Source", 1, defineEnumHandler(ShortTypeHandler, {
	0: "Unknown",
	1: "Daylight",
	2: "Fluorescent",
	3: "Tungsten (Incandescent Light)",
	4: "Flash",
	9: "Fine Weather",
	10: "Cloudy Weather",
	11: "Shade",
	12: "Daylight Fluorescent (D 5700 - 7100K)",
	13: "Day White Fluorescent (N 4600 - 5500K)",
	14: "Cool white Fluorescent (W 3800 - 4500K)",
	15: "White Fluorescent (WW 3250 - 3800K)",
	16: "Warm white fluorescent (L 2600 - 3250K)",
	17: "Standard Light A",
	18: "Standard Light B",
	19: "Standard Light C",
	20: "D55",
	21: "D65",
	22: "D75",
	23: "D50",
	24: "ISO Studio Tungsten",
	255: "Other"
}, "Reserved"), "Kind of light source used to take the picture.")
