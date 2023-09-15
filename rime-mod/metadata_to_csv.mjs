// CSV conversion is based on RFC 4180
import { MetadataResult } from "./metadata.mjs"

/**
 * @param {string} text
 */
function csvEscape(text) {
	const enclose = text.indexOf("\r") != -1 || text.indexOf("\n") != -1 || text.indexOf(",") != -1 || text.indexOf("\"") != -1

	if (enclose) {
		return `"${text.replace(/"/g, "\"\"")}"`
	}

	return text
}

/**
 * @param {MetadataResult[]} mds
 */
export function metadataToCSV(mds) {
	let result = "No.,Name,Value\r\n"
	let i = 1

	for (const md of mds) {
		result += `${i++},${csvEscape(md.name)},${csvEscape(md.value)}\r\n`
	}

	return result.substring(0, result.length - 2)
}
