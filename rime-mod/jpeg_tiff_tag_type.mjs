import { Fraction } from "./fraction.mjs"
import { readUint16, readUint32, writeUint16, writeUint32 } from "./binary_manipulation.mjs"

export const TIFF_LONG = 4

/**
 * @typedef {{type: number, buffer: Uint8Array, count: number}} TagEncodeResult
 */

/**
 * @param {number} tagNum
 */
export function getElementSize(tagNum) {
	switch (tagNum) {
		case 1:  // BYTE
		case 2:  // ASCII
		case 6:  // SBYTE
		case 7:  // UNDEFINED
			return 1
		case 3:  // SHORT
		case 8:  // SSHORT
			return 2
		case 4:  // LONG
		case 9:  // SLONG
		case 11: // FLOAT
			return 4
		case 5:  // RATIONAL
		case 10: // SRATIONAL
		case 12: // DOUBLE
			return 8
		default:
			return 0
	}
}

export class RawIFDData {
	/**
	 * @param {number} type
	 * @param {number} count
	 * @param {Uint8Array} data
	 */
	constructor(type, count, data) {
		this.type = type
		this.count = count
		this.data = data
	}
}

export class ParsedIFDData {
	/**
	 * @param {{name: string, handler: TagTypeHandler, level: number, info: string}} info
	 * @param {number} tagNum
	 * @param {number} offset
	 * @param {number} count
	 * @param {boolean} bigEndian
	 * @param {TagTypeHandler<any>} handler
	 * @param {Uint8Array} data
	 */
	//data, tagNum, off, bigendian, count
	constructor(info, tagNum, bigEndian, count, data) {
		this.name = info.name
		this.level = info.level
		this.description = info.info
		this.handler = info.handler
		this.parsedData = info.handler.decode(data, tagNum, 0, bigEndian, count)
	}

	toString() {
		return this.handler.toReadable(this.parsedData)
	}

	/**
	 * @param {boolean} bigEndian
	 */
	encode(bigEndian) {
		return this.handler.encode(this.parsedData, bigEndian)
	}
}

/**
 * @template T
 */
export class TagTypeHandler {
	/**
	 * @param {number} tagNum 
	 */
	accept(tagNum) {
		return false
	}

	/**
	 * @param {Uint8Array} data
	 * @param {number} tagNum
	 * @param {number} off
	 * @param {boolean} bigendian
	 * @param {number} count
	 * @return {T}
	 */
	decode(data, tagNum, off, bigendian, count) {
		throw new Error("need to override decode")
	}

	/**
	 * @param {T} data
	 * @param {boolean} bigendian
	 * @return {TagEncodeResult}
	 */
	encode(data, bigendian) {
		throw new Error("need to override encode")
	}

	/**
	 * @param {T} data 
	 * @return {string}
	 */
	toReadable(data) {
		return ""
	}
}


/**
 * @extends TagTypeHandler<number[]>
 */
export class ByteTypeHandler extends TagTypeHandler {
	/**
	 * @param {number} tagNum 
	 */
	accept(tagNum) {
		return tagNum == 1
	}

	/**
	 * @param {Uint8Array} data
	 * @param {number} tagNum
	 * @param {number} off
	 * @param {boolean} bigendian
	 * @param {number} count
	 */
	decode(data, tagNum, off, bigendian, count) {
		return [...data.slice(off, off + count)]
	}

	/**
	 * @param {number[]} data
	 * @param {boolean} bigendian
	 */
	encode(data, bigendian) {
		return { type: 1, buffer: new Uint8Array(data), count: data.length }
	}

	/**
	 * @param {number[]} data
	 */
	toReadable(data) {
		return data.join(", ")
	}
}

/**
 * @extends TagTypeHandler<string>
 */
export class ASCIITypeHandler extends TagTypeHandler {
	constructor() {
		super()
		this.encoder = new TextEncoder()
	}

	/**
	 * @param {number} tagNum
	 */
	accept(tagNum) {
		return tagNum == 2
	}

	/**
	 * @param {Uint8Array} data
	 * @param {number} tagNum
	 * @param {number} off
	 * @param {boolean} bigendian
	 * @param {number} count
	 */
	decode(data, tagNum, off, bigendian, count) {
		// count - 1 for null terminator
		return String.fromCharCode(...data.slice(off, off + count - 1))
	}

	/**
	 * @param {string} data
	 * @param {boolean} bigendian
	 */
	encode(data, bigendian) {
		let arr = this.encoder.encode(data + "\u0000")
		return { type: 2, buffer: arr, count: data.length + 1 }
	}

	/**
	 * @param {string} data
	 */
	toReadable(data) {
		return data
	}
}

/**
 * @extends TagTypeHandler<number[]>
 */
export class ShortTypeHandler extends TagTypeHandler {
	/**
	 * @param {number} tagNum
	 */
	accept(tagNum) {
		return tagNum == 3
	}

	/**
	 * @param {Uint8Array} data
	 * @param {number} tagNum
	 * @param {number} off
	 * @param {boolean} bigendian
	 * @param {number} count
	 */
	decode(data, tagNum, off, bigendian, count) {
		/** @type {number[]} */
		let result = []

		for (let i = 0; i < count; i++) {
			result.push(readUint16(data, off + i * 2, bigendian))
		}

		return result
	}

	/**
	 * @param {number[]} data
	 * @param {boolean} bigendian
	 */
	encode(data, bigendian) {
		let arr = new Uint8Array(data.length * 2)

		for (let i = 0; i < data.length; i++) {
			writeUint16(arr, i * 2, bigendian, data[i])
		}

		return { type: 3, buffer: arr, count: data.length }
	}

	/**
	 * @param {number[]} data
	 */
	toReadable(data) {
		return data.join(", ")
	}
}


/**
 * @extends TagTypeHandler<number[]>
 */
export class LongTypeHandler extends TagTypeHandler {
	/**
	 * @param {number} tagNum
	 */
	accept(tagNum) {
		return tagNum == 4
	}

	/**
	 * @param {Uint8Array} data
	 * @param {number} tagNum
	 * @param {number} off
	 * @param {boolean} bigendian
	 * @param {number} count
	 */
	decode(data, tagNum, off, bigendian, count) {
		/** @type {number[]} */
		let result = []

		for (let i = 0; i < count; i++) {
			result.push(readUint32(data, off + i * 4, bigendian))
		}

		return result
	}

	/**
	 * @param {number[]} data
	 * @param {boolean} bigendian
	 */
	encode(data, bigendian) {
		let arr = new Uint8Array(data.length * 4)

		for (let i = 0; i < data.length; i++) {
			writeUint32(arr, i * 4, bigendian, data[i])
		}

		return { type: 4, buffer: arr, count: data.length }
	}

	/**
	 * @param {number[]} data
	 */
	toReadable(data) {
		return data.join(", ")
	}
}

/**
 * @extends TagTypeHandler<Fraction[]>
 */
export class RationalTypeHandler extends TagTypeHandler {
	/**
	 * @param {number} tagNum
	 */
	accept(tagNum) {
		return tagNum == 5
	}

	/**
	 * @param {Uint8Array} data
	 * @param {number} tagNum
	 * @param {number} off
	 * @param {boolean} bigendian
	 * @param {number} count
	 */
	decode(data, tagNum, off, bigendian, count) {
		/** @type {Fraction[]} */
		let result = []

		for (let i = 0; i < count; i++) {
			const num = readUint32(data, off + i * 8, bigendian)
			const den = readUint32(data, off + i * 8 + 4, bigendian)
			result.push(new Fraction(num, den))
		}

		return result
	}

	/**
	 * @param {Fraction[]} data
	 * @param {boolean} bigendian
	 */
	encode(data, bigendian) {
		let arr = new Uint8Array(data.length * 8)

		for (let i = 0; i < data.length; i++) {
			const frac = data[i]
			writeUint32(arr, i * 8, bigendian, frac.n)
			writeUint32(arr, i * 8 + 4, bigendian, frac.d)
		}

		return { type: 5, buffer: arr, count: data.length }
	}

	/**
	 * @param {Fraction[]} data
	 */
	toReadable(data) {
		/** @type {string[]} */
		let result = []

		for (const f of data) {
			result.push(f.n.toString() + "/" + f.d.toString())
		}

		return result.join(", ")
	}
}

/**
 * @extends TagTypeHandler<Uint8Array>
 */
export class UndefinedTypeHandler extends TagTypeHandler {
	/**
	 * @param {number} tagNum
	 */
	accept(tagNum) {
		return tagNum == 7
	}

	/**
	 * @param {Uint8Array} data
	 * @param {number} tagNum
	 * @param {number} off
	 * @param {boolean} bigendian
	 * @param {number} count
	 */
	decode(data, tagNum, off, bigendian, count) {
		return data.slice(off, off + count)
	}

	/**
	 * @param {Uint8Array} data
	 * @param {boolean} bigendian
	 */
	encode(data, bigendian) {
		return { type: 7, buffer: data, count: data.length }
	}

	/**
	 * @param {Uint8Array} data
	 */
	toReadable(data) {
		/** @type {string[]} */
		let result = []

		for (const n of data) {
			if (n == 13) {
				result.push("\\r")
			} else if (n == 10) {
				result.push("\\n")
			} else if (n < 32 || n > 127) {
				result.push("\\x", n.toString(16).toUpperCase())
			} else {
				result.push(String.fromCharCode(n))
			}
		}

		return result.join("")
	}
}

/**
 * @extends TagTypeHandler<number[]>
 */
export class ShortOrLongTypeHandler extends TagTypeHandler {
	/**
	 * @param {number} tagNum
	 */
	accept(tagNum) {
		return tagNum == 3 || tagNum == 4
	}

	/**
	 * @param {Uint8Array} data
	 * @param {number} tagNum
	 * @param {number} off
	 * @param {boolean} bigendian
	 * @param {number} count
	 */
	decode(data, tagNum, off, bigendian, count) {
		/** @type {number[]} */
		let result = []
		const size = tagNum == 4 ? 4 : 2
		const f = tagNum == 4 ? readUint32 : readUint16

		for (let i = 0; i < count; i++) {
			result.push(f(data, off + i * size, bigendian))
		}

		return result
	}

	/**
	 * @param {number[]} data
	 * @param {boolean} bigendian
	 */
	encode(data, bigendian) {
		let useLong = false

		for (let i = 0; i < data.length; i++) {
			if (data[i] > 65535) {
				useLong = true
				break
			}
		}

		const dataSize = useLong ? 4 : 2
		const func = useLong ? writeUint32 : writeUint16
		const arr = new Uint8Array(data.length * dataSize)

		for (let i = 0; i < data.length; i++) {
			func(arr, i * dataSize, bigendian, data[i])
		}

		return { type: 3 + useLong, buffer: arr, count: data.length }
	}

	/**
	 * @param {number[]} data
	 */
	toReadable(data) {
		return data.join(", ")
	}
}

/**
 * @extends TagTypeHandler<TagEncodeResult>
 */
export class UnknownTypeHandler extends TagTypeHandler {
	/**
	 * @param {number} tagNum
	 */
	accept(tagNum) {
		return true
	}

	/**
	 * @param {Uint8Array} data
	 * @param {number} tagNum
	 * @param {number} off
	 * @param {boolean} bigendian
	 * @param {number} count
	 */
	decode(data, tagNum, off, bigendian, count) {
		const byteSize = getElementSize(tagNum) * count
		return { type: tagNum, buffer: data.slice(off, off + byteSize), count: count }
	}

	/**
	 * @param {TagEncodeResult} data
	 * @param {boolean} bigendian
	 */
	encode(data, bigendian) {
		return data
	}

	/**
	 * @param {TagEncodeResult} data
	 */
	toReadable(data) {
		return `Unknown data (type ${data.type} count ${data.count})`
	}
}
