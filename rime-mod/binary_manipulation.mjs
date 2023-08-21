/**
 * @param {Uint8Array} buffer
 * @param {number} off
 * @param {boolean} bigendian
 */
export function readUint16(buffer, off, bigendian) {
	const a = buffer[off]
	const b = buffer[off + 1]

	return bigendian ? ((a << 8) | b) : (a | (b << 8))
}

/**
 * @param {Uint8Array} buffer
 * @param {number} off
 * @param {boolean} bigendian
 * @param {number} value
 */
export function writeUint16(buffer, off, bigendian, value) {
	const a = value & 0xFF
	const b = (value & 0xFF00) >> 8

	if (bigendian) {
		buffer[off] = b
		buffer[off + 1] = a
	} else {
		buffer[off] = a
		buffer[off + 1] = b
	}
}

/**
 * @param {Uint8Array} buffer
 * @param {number} off
 * @param {boolean} bigendian
 */
export function readUint32(buffer, off, bigendian) {
	const a = buffer[off]
	const b = buffer[off + 1]
	const c = buffer[off + 2]
	const d = buffer[off + 3]

	if (bigendian) {
		return (a << 24) | (b << 16) | (c << 8) | d
	} else {
		return a | (b << 8) | (c << 16) | (d << 24)
	}
}

/**
 * @param {Uint8Array} buffer
 * @param {number} off
 * @param {boolean} bigendian
 * @param {number} value
 */
export function writeUint32(buffer, off, bigendian, value) {
	const a = value & 0xFF
	const b = (value & 0xFF00) >> 8
	const c = (value & 0xFF0000) >> 16
	const d = (value & 0xFF000000) >> 24

	if (bigendian) {
		buffer[off] = d
		buffer[off + 1] = c
		buffer[off + 2] = b
		buffer[off + 3] = a
	} else {
		buffer[off] = a
		buffer[off + 1] = b
		buffer[off + 2] = c
		buffer[off + 3] = d
	}
}
