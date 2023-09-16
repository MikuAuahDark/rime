// CSV conversion is based on RFC 4180
import { MetadataResult } from "./metadata.mjs"

const CSV_NEED_ESCAPE = ["\r", "\n", ",", "\""]

/**
 * @param {string} text
 */
function needsEscape(text) {
	for (const char of CSV_NEED_ESCAPE) {
		if (text.includes(char)) {
			return true
		}
	}

	return false
}

/**
 * @param {string} text
 */
function csvEscape(text) {
	if (needsEscape(text)) {
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
