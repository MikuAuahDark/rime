import { Fraction } from "./fraction.mjs"
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
 * @param {{[key: number|string]: string}} values 
 * @param {string} defval
 */
function defineEnumHandler(extendsClass, values, defval = "Unknown") {
	return class extends extendsClass {
		/**
		 * @param {number[]} data
		 */
		toReadable(data) {
			const v = values[data[0]]
			return v ? v : defval
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

/**
 * @template {typeof RationalTypeHandler} T
 * @param {T} extendsClass 
 * @param {string} unit
 */
function defineRationalUnitHandler(extendsClass, unit) {
	return class extends extendsClass {
		/**
		 * @param {Fraction[]} data
		 */
		toReadable(data) {
			const v = data[0]
			return v.d == 0xFFFFFFFF ? "Unknown" : `${v.n / v.d} ${unit}`
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

class FlashStatusHandler extends ShortTypeHandler {
	/**
	 * @param {number[]} data
	 */
	toReadable(data) {
		const flash = data[0]
		const result = [
			(flash & 1) ? "Fired" : "Not Fired",
		]

		switch ((flash >> 1) & 3) {
			case 0:
				result.push("No Return Detection")
				break
			case 1:
			default:
				result.push("Reserved Return Light")
				break
			case 2:
				result.push("No Strobe Return Light")
				break
			case 3:
				result.push("Strobe Return Light")
				break
		}

		switch ((flash >> 3) & 3) {
			case 0:
			default:
				result.push("Unknown Flash Mode")
				break
			case 1:
				result.push("Compulsory Firing")
				break
			case 2:
				result.push("Compulsory Suppression")
				break
			case 3:
				result.push("Auto Mode")
				break
		}

		result.push((flash & 32) ? "Has Flash" : "No Flash")
		result.push((flash & 64) ? "Red-Eye Reduction" : "No Red-Eye Reduction")

		return result.join(", ")
	}
}

const CODE_ASCII = [0x41, 0x53, 0x43, 0x49, 0x49, 0, 0, 0]
const CODE_JIS = [0x4A, 0x49, 0x53, 0, 0, 0, 0, 0]
const CODE_UNICODE = [0x55, 0x4E, 0x49, 0x43, 0x4F, 0x44, 0x45, 0]
const CODE_UNDEFINED = [0, 0, 0, 0, 0, 0, 0, 0]

class UserCommentHandler extends UndefinedTypeHandler {

	/**
	 * @param {Uint8Array} data
	 */
	toReadable(data) {
		if (UserCommentHandler.isArrayEqual(data, CODE_ASCII)) {
			// ASCII
			const result = []

			for (const n of data.slice(8)) {
				result.push(String.fromCharCode(n))
			}

			return result.join("")
		} else if (UserCommentHandler.isArrayEqual(data, CODE_UNDEFINED)) {
			return super.toReadable(data.slice(8))
		} else if (UserCommentHandler.isArrayEqual(data, CODE_JIS)) {
			return "TODO JIS " + super.toReadable(data.slice(8))
		} else if (UserCommentHandler.isArrayEqual(data, CODE_UNICODE)) {
			return "TODO UNICODE " + super.toReadable(data.slice(8))
		} else {
			return "Unknown Data"
		}
	}

	/**
	 * @param {Uint8Array} haystack
	 * @param {number[]} needle
	 * @param {number} start
	 */
	static isArrayEqual(haystack, needle, start = 0) {
		if ((start + needle.length) >= haystack.length) {
			return false
		}

		for (let i = 0; i < needle.length; i++) {
			if (haystack[start + i] != needle[i]) {
				return false
			}
		}

		return true
	}
}

class LensSpecHandler extends RationalTypeHandler {
	/**
	 * @param {Fraction[]} d
	 */
	toReadable(d) {
		if (d.length < 4) {
			return "Unknown"
		}

		const minfl = LensSpecHandler.stringify(d[0])
		const maxfl = LensSpecHandler.stringify(d[1])
		const minfn = LensSpecHandler.stringify(d[2])
		const maxfn = LensSpecHandler.stringify(d[3])
		return `Focal Length ${minfl} - ${maxfl} mm, f/${minfn} - f/${maxfn}`
	}

	/**
	 * @param {Fraction} d
	 */
	static stringify(d) {
		return d.d == 0 ? "Unknown" : (d.n / d.d).toString()
	}
}

class GPSLatRefHandler extends ASCIITypeHandler {
	/**
	 * @param {string} d
	 */
	toReadable(data) {
		switch (data) {
			case "N":
				return "North"
			case "S":
				return "South"
			default:
				return "Reserved"
		}
	}
}

class GPSLonRefHandler extends ASCIITypeHandler {
	/**
	 * @param {string} d
	 */
	toReadable(data) {
		switch (data) {
			case "E":
				return "East"
			case "W":
				return "West"
			default:
				return "Reserved"
		}
	}
}

class GPSPositionHandler extends RationalTypeHandler {
	/**
	 * @param {Fraction[]} d
	 */
	toReadable(d) {
		if (d.length < 3) {
			return "Unknown"
		}

		return `${d[0].n / d[0].d}°${d[1].n / d[1].d}'${d[2].n / d[2].d}"`
	}
}

class GPSAltitudeRefHandler extends ByteTypeHandler {
	/**
	 * @param {number[]} data
	 */
	toReadable(data) {
		if (data[0] == 0) {
			return "At/Above Sea Level"
		} else {
			return "Below Sea Level"
		}
	}
}

class GPSTimestampHandler extends RationalTypeHandler {
	/**
	 * @param {Fraction[]} d
	 */
	toReadable(d) {
		if (d.length < 3) {
			return "Unknown"
		}

		const hour = d[0].n / d[0].d
		const minute = d[1].n / d[1].d
		const second = d[2].n / d[2].d
		const ts = second + minute * 60 + hour * 3600

		return `${Math.floor(ts / 3600)}:${Math.floor(ts / 60 % 60)}:${ts % 60}`
	}
}

class RationalToFloatHandler extends RationalTypeHandler {
	/**
	 * @param {Fraction[]} d
	 */
	toReadable(d) {
		return (d[0].n / d[0].d).toString()
	}
}

/***************************
 ****** TIFF Metadata ******
 ***************************/

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
defineTag(315, "Artist", 1, ASCIITypeHandler,
	"This tag records the name of the camera owner, photographer or image creator."
)

/***************************
 ****** EXIF Metadata ******
 ***************************/

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
defineTag(0x9209, "Flash Status", 1, FlashStatusHandler,
	"This tag indicates the status of flash when the image was shot."
)
defineTag(0x920A, "Focal Length", 1, defineUnitHandler(RationalTypeHandler, "mm"),
	"The actual focal length of the lens, in mm. Conversion is not made to the focal length of a 35 mm film camera."
)
defineTag(0x927C, "Maker Note", 1, UndefinedTypeHandler,
	"A tag for manufacturers of Exif/DCF writers to record any desired information. " +
	"The contents are up to the manufacturer."
)
defineTag(0x9286, "User Comment", 1, UserCommentHandler,
	"A tag for Exif users to write keywords or comments on the image besides those in \"Image Description\", and " +
	"without the character code limitations of the \"Image Description\" tag."
)
defineTag(0x9290, "Subsecond Time", 2, ASCIITypeHandler,
	"A tag used to record fractions of seconds for the \"Date & Time\" tag"
)
defineTag(0x9291, "Original Subsecond Time", 2, ASCIITypeHandler,
	"A tag used to record fractions of seconds for the \"Original Date & Time\" tag."
)
defineTag(0x9292, "Digitized Subsecond Time", 2, ASCIITypeHandler,
	"A tag used to record fractions of seconds for the \"Digitized Date & Time\" tag."
)
// TODO defineTag(0x9400, "Temperature")
defineTag(0x9401, "Humidity", 1, defineRationalUnitHandler(RationalTypeHandler, "%"),
	"Humidity as the ambient situation at the shot, for example the room humidity where the photographer was " +
	"holding the camera"
)
defineTag(0x9402, "Pressure", 1, defineRationalUnitHandler(RationalTypeHandler, "hPa"),
	"Pressure as the ambient situation at the shot, for example the room atmospfere where the photographer was " +
	"holding the camera or the water pressure under the sea."
)
// TODO defineTag(0x9403, "Water Depth")
defineTag(0x9404, "Acceleration", 1, defineRationalUnitHandler(RationalTypeHandler, "mGal"),
	"Acceleration (a scalar regardless of direction) as the ambient situation at the shot, for example the driving " +
	"acceleration of the vehicle which the photographer rode on at the shot."
)
// TODO defineTag(0x9405, "Camera Elevation Angle")
defineTag(0xA20B, "Flash Energy", 1, defineUnitHandler(RationalTypeHandler, "BPCS"),
	"Indicates the strobe energy at the time the image is captured."
)
defineTag(0xA215, "Exposure Index", 1, RationalTypeHandler,
	"Indicates the exposure index selected on the camera or input device at the time the image is captured."
)
defineTag(0xA217, "Sensing Method", 1, defineEnumHandler(ShortTypeHandler, {
	1: "Not Defined",
	2: "One-Chip Color Area Sensor",
	3: "Two-Chip Color Area Sensor",
	4: "Three-Chip Color Area Sensor",
	5: "Color Sequential Area Sensor",
	6: "Trilinear Area Sensor",
	7: "Color Sequential Linear Sensor",
}, "Reserved"), "Indicates the image sensor type on the camera or input device.")
defineTag(0xA300, "File Source", 1, defineEnumHandler(UndefinedTypeHandler, {
	0: "Other",
	1: "Scanner (Transparent Type)",
	2: "Scanner (Reflex Type)",
	3: "DSC",
}, "Reserved"), "Indicates the image source.")
defineTag(0xA301, "Scene Type", 1, defineEnumHandler(UndefinedTypeHandler, {
	1: "Direct Photograph"
}, "Reserved"), "Indicates the type of scene.")
defineTag(0xA430, "Camera Owner", 2, ASCIITypeHandler, "This tag records the owner of a camera used in photography.")
defineTag(0xA431, "Camera Body S/N", 2, ASCIITypeHandler,
	"This tag records the serial number of the body of the camera that was used in photography."
)
defineTag(0xA432, "Lens Specification", 1, LensSpecHandler,
	"This tag notes minimum focal length, maximum focal length, minimum F number in the minimum focal length, and " +
	"minimum F number in the maximum focal length, which are specification information for the lens that was used " +
	"in photography."
)
defineTag(0xA433, "Lens Manufacturer", 1, ASCIITypeHandler, "This tag records the lens manufacturer.")
defineTag(0xA434, "Lens Model", 1, ASCIITypeHandler, "This tag records the lens's model name and model number.")
defineTag(0xA435, "Lens S/N", 2, ASCIITypeHandler,
	"This tag records the serial number of the interchangeable lens that was used in photography."
)

/*******************************
 ****** EXIF GPS Metadata ******
 *******************************/

defineTag(1, "Latitude Ref", 2, GPSLatRefHandler,
	"Indicates whether the latitude is north or south latitude.",
	GPS_TAGS
)
defineTag(2, "Latitude", 2, GPSPositionHandler,
	"Indicates the latitude in Degrees, minutes, and seconds (DMS)",
	GPS_TAGS
)
defineTag(3, "Longitude Ref", 2, GPSLonRefHandler,
	"Indicates whether the longitude is east or west longitude.",
	GPS_TAGS
)
defineTag(4, "Longitude", 2, GPSPositionHandler,
	"Indicates the longitude in Degrees, minutes, and seconds (DMS)",
	GPS_TAGS
)
defineTag(5, "Altitude Reference", 2, GPSAltitudeRefHandler,
	"Indicates the altitude used as the reference altitude. If the altitude is below sea level, the altitude is " +
	"indicated as a negative absolute value in the \"Altitude\" tag.",
	GPS_TAGS
)
defineTag(6, "Altitude", 2, defineUnitHandler(RationalToFloatHandler, "meters"),
	"Indicates the altitude based on the reference in \"Altitude Reference\".",
	GPS_TAGS
)
defineTag(7, "GPS Timestamp", 2, GPSTimestampHandler,
	"Indicates the GPS time as UTC (Coordinated Universal Time) in 24-hour format.",
	GPS_TAGS
)
defineTag(8, "GPS Satellites", 2, ASCIITypeHandler,
	"Indicates the GPS satellites used for measurements. This tag may be used to describe the number of " +
	"satellites, their ID number, angle of elevation, azimuth, SNR and other information.",
	GPS_TAGS
)
defineTag(9, "GPS Status", 1, defineEnumHandler(ASCIITypeHandler, {
	"A": "Measurement In Progress",
	"V": "Measurement Interrupted"
}, "Reserved"), "Indicates the status of the GPS receiver when the image is recorded.", GPS_TAGS)
defineTag(10, "GPS Measurement Mode", 1, defineEnumHandler(ASCIITypeHandler, {
	"2": "2-Dimensional Measurement",
	"3": "3-Dimensional Measurement"
}, "Reserved"), "Indicates the GPS measurement mode.", GPS_TAGS)
defineTag(11, "GPS DOP", 2, RationalToFloatHandler,
	"Indicates the GPS DOP (dilution of precision). An Horizontal DOP value is written during two-dimensional " +
	"measurement, and Positional DOP during three-dimensional measurement.",
	GPS_TAGS
)
defineTag(12, "Speed Unit", 1, defineEnumHandler(ASCIITypeHandler, {
	"K": "Km/h",
	"M": "Mph",
	"N": "Knots"
}, "Reserved"), "Indicates the unit used to express the GPS receiver speed of movement.", GPS_TAGS)
defineTag(13, "Speed", 1, RationalToFloatHandler,
	"Indicates the speed of GPS receiver movement.",
	GPS_TAGS
)
