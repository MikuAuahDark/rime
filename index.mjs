import { loadMetadata } from "./rime-mod/main.mjs";
import { Metadata } from "./rime-mod/metadata.mjs";
import { metadataToCSV } from "./rime-mod/metadata_to_csv.mjs";

/**
 * @typedef {{id: string, name: string, value: string, level: number}} MetadataResult
 * @typedef {{buffer: ArrayBuffer, name: string}} ExportCSVResult
 */

const METADATA_ID_PREFIX = "metadata__"
const DEFAULT_SELECTED_LEVEL = 2
const SVG_NAMESPACE = "http://www.w3.org/2000/svg"

class LayoutManager {
	constructor() {
		/** @type {((file: File) => void)|null} */
		this.processFile = null
		/** @type {string|null} */
		this.inputObjectURL = null
		/** @type {string|null} */
		this.outputObjectURL = null
		/** @type {string|null} */
		this.csvObjectURL = null
		/** @type {(() => ExportCSVResult|null)|null} */
		this.exportCSV = null

		/** @type {HTMLDivElement} */
		this.inputArea = document.getElementById("input_area")
		/** @type {HTMLImageElement} */
		this.inputImage = document.getElementById("input_image")
		/** @type {HTMLDivElement} */
		this.inputAreaInfo = document.getElementById("input_area_info")
		/** @type {HTMLInputElement} */
		this.inputFile = document.getElementById("input_file")
		/** @type {HTMLAnchorElement} */
		this.downloadClicker = document.getElementById("download_clicker")
		/** @type {HTMLElement} */
		this.metadataInfoListSection = document.getElementById("metadata_info_list")
		/** @type {HTMLTableElement} */
		this.metadataListTable = document.getElementById("metadata_list_table")
		/** @type {HTMLTableSectionElement} */
		this.metadataListTableBody = document.getElementById("metadata_list")
		/** @type {HTMLButtonElement} */
		this.removeMetadataButton = document.getElementById("remove_metadata")
		/** @type {HTMLElement} */
		this.imageResultSection = document.getElementById("image_result")
		/** @type {HTMLImageElement} */
		this.outputImage = document.getElementById("output_image")
		/** @type {HTMLButtonElement} */
		this.downloadImageButton = document.getElementById("download_image")

		// Initialize styles
		this.errorAlert = new mdc.snackbar.MDCSnackbar(document.querySelector(".mdc-snackbar"))
		this.metadataListTableMDC = new mdc.dataTable.MDCDataTable(this.metadataListTable)

		// Initialize top bar
		this.topBar = new mdc.topAppBar.MDCTopAppBar(document.querySelector(".mdc-top-app-bar"))

		// Initialize events
		this.inputArea.addEventListener("click", this.inputAreaClick.bind(this))
		this.inputArea.addEventListener("dragenter", this.dragEnter.bind(this))
		this.inputArea.addEventListener("dragleave", this.dragLeave.bind(this))
		this.inputArea.addEventListener("dragover", this.dragOver.bind(this))
		this.inputArea.addEventListener("drop", this.dropEvent.bind(this))
		this.inputFile.addEventListener("change", this.inputFileChange.bind(this))

		/** @type {NodeListOf<HTMLButtonElement>} */
		const buttons = document.querySelectorAll(".rime_buttons button")
		for (let i = 0; i < buttons.length; i += 4) {
			// Export CSV is first button
			buttons[i].addEventListener("click", this.performExportCSV.bind(this))
		}
	}

	/**
	 * @param {MouseEvent} e
	 */
	inputAreaClick(e) {
		this.inputFile.click()
	}

	/**
	 * @param {DragEvent} e
	 */
	dragEnter(e) {
		e.stopPropagation()
		e.preventDefault()

		this.inputArea.classList.add("mdc-elevation--z12")
		this.inputArea.classList.remove("mdc-elevation--z1")
		this.inputImage.style.filter = "opacity(25%) blur(2px)"
		if (this.inputObjectURL) {
			this.inputAreaInfo.style.visibility = "visible"
		}
	}

	/**
	 * @param {DragEvent} e
	 */
	dragLeave(e) {
		e.stopPropagation()
		e.preventDefault()

		this.inputArea.classList.add("mdc-elevation--z1")
		this.inputArea.classList.remove("mdc-elevation--z12")
		this.inputImage.style.filter = "opacity(100%) blur(0px)"
		if (this.inputObjectURL) {
			this.inputAreaInfo.style.visibility = "hidden"
		}
	}

	/**
	 * @param {DragEvent} e
	 */
	dragOver(e) {
		e.stopPropagation()
		e.preventDefault()
	}

	/**
	 * @param {DragEvent} e
	 */
	dropEvent(e) {
		e.stopPropagation()
		e.preventDefault()

		this.inputArea.classList.add("mdc-elevation--z1")
		this.inputArea.classList.remove("mdc-elevation--z12")
		this.inputImage.style.filter = "opacity(100%) blur(0px)"
		if (this.inputObjectURL) {
			this.inputAreaInfo.style.visibility = "hidden"
		}

		if (e.dataTransfer.items) {
			for (const item of e.dataTransfer.items) {
				if (item.kind == "file") {
					const file = item.getAsFile()
					if (this.processFile) {
						this.processFile(file)
					}
					break
				}
			}
		} else {
			for (const file of e.dataTransfer.files) {
				if (this.processFile) {
					this.processFile(file)
				}
				break
			}
		}
	}


	/**
	 * @param {Event} e
	 */
	inputFileChange(e) {
		e.preventDefault()
		if (this.inputFile.files) {
			for (const file of this.inputFile.files) {
				if (this.processFile) {
					this.processFile(file)
				}
				break
			}
		}

		this.inputFile.value = null
	}

	/**
	 * @param {(file: File) => void} cb
	 */
	setProcessFileCallback(cb) {
		this.processFile = cb
	}

	/**
	 * @param {() => ExportCSVResult|null} cb
	 */
	setExportCSVCallback(cb) {
		this.exportCSV = cb
	}

	showError(message) {
		window.getLastError = message

		let msg = ""
		if (message instanceof Error) {
			msg = message.message
		} else {
			msg = toString(message)
		}

		this.errorAlert.labelText = msg
		this.errorAlert.open()
	}

	showInputImage(buffer) {
		const url = URL.createObjectURL(buffer)
		this.inputImage.src = url

		if (this.inputObjectURL) {
			URL.revokeObjectURL(this.inputObjectURL)
		}

		this.inputObjectURL = url
		this.inputAreaInfo.style.removeProperty("height")
		this.inputAreaInfo.style.visibility = "hidden"
	}

	showMetadataInfo() {
		this.metadataInfoListSection.style.removeProperty("display")
	}

	/**
	 * @param {MetadataResult[]} metadata 
	 */
	setTableData(metadata) {
		/** @type {HTMLTableRowElement[]} */
		const rows = []

		for (const md of metadata) {
			const selected = md.level >= DEFAULT_SELECTED_LEVEL
			const metadataId = METADATA_ID_PREFIX + md.id

			const tr = document.createElement("tr")
			tr.setAttribute("data-row-id", metadataId)
			tr.setAttribute("aria-selected", selected.toString())
			tr.classList.add("mdc-data-table__row")
			if (selected) {
				tr.classList.add("mdc-data-table__row--selected")
			}

			const td1 = document.createElement("td")
			td1.classList.add("mdc-data-table__cell", "mdc-data-table__cell--checkbox")

			const div1 = document.createElement("div")
			div1.classList.add("mdc-checkbox", "mdc-data-table__row-checkbox")
			if (selected) {
				div1.classList.add("mdc-checkbox--selected")
			}

			const checkbox = document.createElement("input")
			checkbox.type = "checkbox"
			checkbox.checked = selected
			checkbox.disabled = md.level == 0
			checkbox.classList.add("mdc-checkbox__native-control")
			checkbox.setAttribute("aria-labelledby", metadataId)

			const div2 = document.createElement("div")
			div2.classList.add("mdc-checkbox__background")

			const svg = document.createElementNS(SVG_NAMESPACE, "svg");
			svg.setAttribute("viewBox", "0 0 24 24")
			svg.classList.add("mdc-checkbox__checkmark")

			const svgPath = document.createElementNS(SVG_NAMESPACE, "path")
			svgPath.classList.add("mdc-checkbox__checkmark-path")
			svgPath.setAttribute("fill", "none")
			svgPath.setAttribute("d", "M1.73,12.91 8.1,19.28 22.79,4.59")

			const div3 = document.createElement("div")
			div3.classList.add("mdc-checkbox__mixedmark")

			const div4 = document.createElement("div")
			div4.classList.add("mdc-checkbox__ripple")

			const th = document.createElement("th")
			th.id = metadataId
			th.textContent = md.name
			th.setAttribute("scope", "row")
			th.classList.add("mdc-data-table__cell")

			const td2 = document.createElement("td")
			td2.textContent = md.value
			td2.classList.add("mdc-data-table__cell")

			svg.replaceChildren(svgPath)
			div2.replaceChildren(svg, div3)
			div1.replaceChildren(checkbox, div2, div4)
			td1.replaceChildren(div1)
			tr.replaceChildren(td1, th, td2)
			rows.push(tr)
		}

		this.metadataListTableBody.replaceChildren(...rows)
		this.metadataListTableMDC.layout()
	}

	performExportCSV() {
		const csv = this.exportCSV ? this.exportCSV() : null

		if (csv !== null) {
			if (this.csvObjectURL) {
				URL.revokeObjectURL(this.csvObjectURL)
			}

			const blob = new Blob([csv.buffer], {type: "text/csv"})
			this.csvObjectURL = URL.createObjectURL(blob)
			this.downloadClicker.href = this.csvObjectURL
			this.downloadClicker.download = csv.name
			this.downloadClicker.click()
		}
	}
}

function main() {
	const layout = new LayoutManager()
	window.currentLayout = layout

	// Initialize ripple
	for (const elem of document.querySelectorAll(".mdc-ripple-surface, .mdc-button")) {
		mdc.ripple.MDCRipple.attachTo(elem)
	}

	/** @type {Metadata|null} */
	let currentState = null
	/** @type {string|null} */
	let currentFilename = null

	const textEncoder = new TextEncoder()

	layout.setProcessFileCallback((file) => {
		file.arrayBuffer()
			.then(async (v) => {
				let newFile = new Uint8Array(v)
				console.log(file.name)

				try {
					currentState = loadMetadata(newFile)
					currentFilename = file.name
					window.currentState = currentState
					window.currentFilename = currentFilename

					layout.showInputImage(file)
					layout.setTableData(currentState.getMetadata())
					layout.showMetadataInfo()
				} catch (e) {
					layout.showError(e)
				}
			})
			.catch(layout.showError.bind(layout))
	})
	layout.setExportCSVCallback(() => {
		if (!currentState || !currentFilename) {
			return null
		}

		const csv = metadataToCSV(currentState)
		return {
			name: currentFilename + ".csv",
			buffer: textEncoder.encode(csv).buffer
		}
	})
}

if (document.readyState !== "loading") {
	main()
} else {
	document.addEventListener("DOMContentLoaded", main)
}
