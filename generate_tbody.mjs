import * as process from "node:process"
import * as fs from "node:fs"
import { loadMetadata } from "./rime-mod/main.mjs"

if (process.argv.length < 3) {
	console.log("usage: %s %s <image>", process.argv[0], process.argv[1])
	process.exit(1)
}

const imageFile = fs.readFileSync(process.argv[2])
const metadata = loadMetadata(new Uint8Array(imageFile))

const METADATA_ID_PREFIX = "metadata__"
const DEFAULT_SELECTED_LEVEL = 2

const matchHtmlRegExp = /["'&<>]/

/**
 * Escape special characters in the given string of text.
 *
 * @param  {string} string The string to escape for inserting into HTML
 * @return {string}
 */

function escapeHtml(string) {
	var str = "" + string
	var match = matchHtmlRegExp.exec(str)

	if (!match) {
		return str
	}

	var escape
	var html = ""
	var index = 0
	var lastIndex = 0

	for (index = match.index; index < str.length; index++) {
		switch (str.charCodeAt(index)) {
			case 34: // "
				escape = "&quot;"
				break
			case 38: // &
				escape = "&amp;"
				break
			case 39: // '
				escape = "&#39;"
				break
			case 60: // <
				escape = "&lt;"
				break
			case 62: // >
				escape = "&gt;"
				break
			default:
				continue
		}

		if (lastIndex !== index) {
			html += str.substring(lastIndex, index)
		}

		lastIndex = index + 1
		html += escape
	}

	return lastIndex !== index
		? html + str.substring(lastIndex, index)
		: html
}

for (const md of metadata.getMetadata()) {
	const selected = md.level >= DEFAULT_SELECTED_LEVEL
	const disabled = md.level == 0
	const metadataId = METADATA_ID_PREFIX + md.id

	const sb = []
	const trClasses = ["mdc-data-table__row"]
	const div1Classes = ["mdc-checkbox", "mdc-data-table__row-checkbox"]
	let inputAttr = ""

	if (selected) {
		trClasses.push("mdc-data-table__row--selected")
		div1Classes.push("mdc-checkbox--selected")
		inputAttr = " checked"
	} else if (disabled) {
		trClasses.push("rime_select_disabled")
		inputAttr = " disabled"
	}

	sb.push(
		`<tr class="${trClasses.join(" ")}" data-row-id="${metadataId}" aria-selected="${selected.toString()}">`,
		"\t<td class=\"mdc-data-table__cell mdc-data-table__cell--checkbox\">",
		`\t\t<div class="${div1Classes.join(" ")}">`,
		`\t\t\t<input type="checkbox" class="mdc-checkbox__native-control" aria-labelledby="${metadataId}"${inputAttr}>`,
		"\t\t\t<div class=\"mdc-checkbox__background\">",
		"\t\t\t\t<svg class=\"mdc-checkbox__checkmark\" viewBox=\"0 0 24 24\">",
		"\t\t\t\t\t<path class=\"mdc-checkbox__checkmark-path\" fill=\"none\" d=\"M1.73,12.91 8.1,19.28 22.79,4.59\" />",
		"\t\t\t\t</svg>",
		"\t\t\t\t<div class=\"mdc-checkbox__mixedmark\"></div>",
		"\t\t\t</div>",
		"\t\t\t<div class=\"mdc-checkbox__ripple\"></div>",
		"\t\t</div>",
		"\t</td>",
		`\t<th scope="row" class="mdc-data-table__cell">${escapeHtml(md.name)}</th>`,
		`\t<td class="mdc-data-table__cell">${escapeHtml(md.value)}</td>`,
		"\t<td class=\"mdc-data-table__cell rime_cell_help\">",
		"\t\t<button class=\"mdc-icon-button material-icons\">",
		"\t\t\t<div class=\"mdc-icon-button__ripple\"></div>",
		"\t\t\thelp",
		"\t\t</button>",
		"\t</td>",
		"</tr>"
	)
	console.log(sb.join("\n"))
}
