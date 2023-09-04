// CSV conversion is based on RFC 4180
import { Metadata } from "./metadata.mjs";

/**
 * @param {string} text
 */
function csvEscape(text) {
	const enclose = text.indexOf("\r\n") != -1 || text.indexOf(",") != -1 || text.indexOf("\"") != -1

	if (enclose) {
		return `\"${text.replace("\"", "\"\"")}\"`
	}

	return text
}

/**
 * @param {Metadata} metadata
 */
export function metadataToCSV(metadata) {
	const mds = metadata.getMetadata()
	let result = "No.,Name,Value\r\n"
	let i = 1

	for (const md of mds) {
		result += `${i},${csvEscape(md.name)},${csvEscape(md.value)}\r\n`
		i++
	}

	return result.substring(0, result.length - 2)
}
