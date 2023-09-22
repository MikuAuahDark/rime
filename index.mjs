import { loadMetadata } from "./rime-mod/main.mjs"
import { Metadata, MetadataResult } from "./rime-mod/metadata.mjs"
import { metadataToCSV } from "./rime-mod/metadata_to_csv.mjs"

/* global mdc */
/**
 * @typedef {{buffer: ArrayBuffer, name: string}} ExportCSVResult
 * @typedef {{buffer: ArrayBuffer, name: string, mime: string}} ImageRemovalResult
 */

const METADATA_ID_PREFIX = "metadata__"
const DEFAULT_SELECTED_LEVEL = 2
const SVG_NAMESPACE = "http://www.w3.org/2000/svg"
const METADATA_LEVEL_DESCRIPTION = [
	"This metadata is essential, thus cannot be removed.",
	"This metadata can be removed, but preserved by default.",
	"It's recommended to remove this metadata."
]

class LayoutManager {
	constructor() {
		/** @type {((file: File) => void)|null} */
		this.processFile = null
		/** @type {string|null} */
		this.inputObjectURL = null
		/** @type {string|null} */
		this.outputObjectURL = null
		/** @type {string|null} */
		this.outputImageFilename = null
		/** @type {string|null} */
		this.csvObjectURL = null
		/** @type {(() => ExportCSVResult|null)|null} */
		this.exportCSV = null
		/** @type {((level:number) => Set<string>)|null} */
		this.metadataSelectLevel = null
		/** @type {((selected:Set<string>) => ImageRemovalResult)|null} */
		this.metadataDeleter = null
		/** @type {{[key: string]: HTMLInputElement}} */
		this.metadataListCheckbox = {}
		this.dirty = true

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
		/** @type {HTMLParagraphElement} */
		this.dirtyWarning = document.getElementById("dirty")
		/** @type {HTMLImageElement} */
		this.outputImage = document.getElementById("output_image")
		/** @type {HTMLButtonElement} */
		this.downloadImageButton = document.getElementById("download_image")
		/** @type {HTMLHeadingElement} */
		this.rimeMetadataDescriptionTitle = document.getElementById("rime_metadata_description_title")
		/** @type {HTMLDivElement} */
		this.rimeMetadataDescriptionContent = document.getElementById("rime_metadata_description_content")

		// Initialize styles
		this.topBar = new mdc.topAppBar.MDCTopAppBar(document.querySelector(".mdc-top-app-bar"))
		this.errorAlert = new mdc.snackbar.MDCSnackbar(document.getElementById("error_alert"))
		this.metadataListTableMDC = new mdc.dataTable.MDCDataTable(this.metadataListTable)
		this.rimeAboutDialog = new mdc.dialog.MDCDialog(document.getElementById("rime_about"))
		this.rimeMetadataDescriptionDialog = new mdc.dialog.MDCDialog(
			document.getElementById("rime_metadata_description")
		)

		// Initialize events
		this.inputArea.addEventListener("click", this.inputAreaClick.bind(this))
		this.inputArea.addEventListener("dragenter", this.dragEnter.bind(this))
		this.inputArea.addEventListener("dragleave", this.dragLeave.bind(this))
		this.inputArea.addEventListener("dragover", this.dragOver.bind(this))
		this.inputArea.addEventListener("drop", this.dropEvent.bind(this))
		this.inputFile.addEventListener("change", this.inputFileChange.bind(this))

		// Wire up buttons
		const exportCSV = this.performExportCSV.bind(this)
		const selectAll = this.metadataLevelFunction(1)
		const selectRecommended = this.metadataLevelFunction(2)
		const clearSelection = this.metadataLevelFunction(0)

		/** @type {NodeListOf<HTMLButtonElement>} */
		const buttons = document.querySelectorAll(".rime_buttons button")
		for (let i = 0; i < buttons.length; i += 4) {
			// Export CSV is first button
			buttons[i].addEventListener("click", exportCSV)
			// Clear Selection is second button
			buttons[i + 1].addEventListener("click", clearSelection)
			// Select Recommended is third button
			buttons[i + 2].addEventListener("click", selectRecommended)
			// Select All is fourth button
			buttons[i + 3].addEventListener("click", selectAll)
		}

		this.removeMetadataButton.addEventListener("click", this.performMetadataRemoval.bind(this))
		this.downloadImageButton.addEventListener("click", this.downloadOutputImage.bind(this))

		const showAbout = (e) => {
			e.preventDefault()
			this.rimeAboutDialog.open()
		}
		for (const elem of document.getElementsByClassName("rime_about_button")) {
			elem.addEventListener("click", showAbout)
		}
	}

	inputAreaClick() {
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
			msg = message.toString()
		}

		this.errorAlert.labelText = msg
		this.errorAlert.open()
	}

	/**
	 * @param {File|Blob} buffer
	 */
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
		const dirtyFlag = this.markDirty.bind(this)
		this.metadataListCheckbox = {}

		for (const md of metadata) {
			const selected = md.level >= DEFAULT_SELECTED_LEVEL
			const disabled = md.level == 0
			const metadataId = METADATA_ID_PREFIX + md.id

			const tr = document.createElement("tr")
			tr.setAttribute("data-row-id", metadataId)
			tr.setAttribute("aria-selected", selected.toString())
			tr.classList.add("mdc-data-table__row")
			if (selected) {
				tr.classList.add("mdc-data-table__row--selected")
			} else if (disabled) {
				tr.classList.add("rime_select_disabled")
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
			checkbox.disabled = disabled
			checkbox.classList.add("mdc-checkbox__native-control")
			checkbox.setAttribute("aria-labelledby", metadataId)
			checkbox.addEventListener("change", dirtyFlag)

			const div2 = document.createElement("div")
			div2.classList.add("mdc-checkbox__background")

			const svg = document.createElementNS(SVG_NAMESPACE, "svg")
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

			const td3 = document.createElement("td")
			td3.classList.add("mdc-data-table__cell", "rime_cell_help")

			const button = document.createElement("button")
			button.classList.add("mdc-icon-button", "material-icons")

			const div5 = document.createElement("div")
			div5.classList.add("mdc-icon-button__ripple")

			svg.replaceChildren(svgPath)
			div2.replaceChildren(svg, div3)
			div1.replaceChildren(checkbox, div2, div4)
			td1.replaceChildren(div1)
			button.replaceChildren(div5, document.createTextNode("help"))
			td3.replaceChildren(button)
			tr.replaceChildren(td1, th, td2, td3);

			(new mdc.ripple.MDCRipple(button)).unbounded = true
			button.addEventListener("click", () => this.showMetadataDescription(md))
			rows.push(tr)

			this.metadataListCheckbox[md.id] = checkbox
		}

		this.metadataListTableBody.replaceChildren(...rows)
		this.metadataListTableMDC.layout()
	}

	/**
	 * @param {string} url
	 * @param {string} filename
	 */
	performClickWithUrl(url, filename) {
		this.downloadClicker.href = url
		this.downloadClicker.download = filename
		this.downloadClicker.click()
	}

	performExportCSV() {
		const csv = this.exportCSV ? this.exportCSV() : null

		if (csv !== null) {
			if (this.csvObjectURL) {
				URL.revokeObjectURL(this.csvObjectURL)
			}

			const blob = new Blob([csv.buffer], { type: "text/csv" })
			this.csvObjectURL = URL.createObjectURL(blob)
			this.performClickWithUrl(this.csvObjectURL, csv.name)
		}
	}

	/**
	 * @param {MetadataResult} md
	 */
	showMetadataDescription(md) {
		const mdDesc = md.description.split("\n").map(document.createTextNode, document)
		const descData = []

		for (let i = 0; i < mdDesc.length; i++) {
			descData.push(mdDesc[i], document.createElement("br"))
		}

		descData.push(document.createElement("br"), document.createTextNode(METADATA_LEVEL_DESCRIPTION[md.level]))

		this.rimeMetadataDescriptionTitle.textContent = md.name
		this.rimeMetadataDescriptionContent.replaceChildren(...descData)
		this.rimeMetadataDescriptionDialog.open()
	}

	/**
	 * @param {(level:number) => Set<string>} func
	 */
	setMetadataSelectionFunction(func) {
		this.metadataSelectLevel = func
	}

	/**
	 * @param {(selected:Set<string>) => ImageRemovalResult} func
	 */
	setRemoveMetadataFunction(func) {
		this.metadataDeleter = func
	}

	/**
	 * @param {number} level
	 */
	selectMetadataLevel(level) {
		if (this.metadataSelectLevel) {
			/** @type {Set<string>|null} */
			let selected = null

			try {
				selected = this.metadataSelectLevel(level)
			} catch (e) {
				this.showError(e)
				return
			}

			for (const [metadataId, checkbox] of Object.entries(this.metadataListCheckbox)) {
				if (checkbox.checked != selected.has(metadataId)) {
					checkbox.click()
				}
			}
		}
	}

	/**
	 * @param {number} level
	 */
	metadataLevelFunction(level) {
		const self = this
		return () => self.selectMetadataLevel(level)
	}

	performMetadataRemoval() {
		if (this.metadataDeleter) {
			// Get selected metadata.
			/** @type {Set<string>} */
			const selected = new Set()

			for (const [key, value] of Object.entries(this.metadataListCheckbox)) {
				if (value.checked) {
					selected.add(key)
				}
			}

			if (selected.size > 0) {
				/** @type {ImageRemovalResult|null} */
				let removed = null
				try {
					removed = this.metadataDeleter(selected)

					if (removed == null) {
						throw new Error("assertion failed")
					}
				} catch (e) {
					this.showError(e)
					return
				}

				const blob = new Blob([removed.buffer], { type: removed.mime })
				const url = URL.createObjectURL(blob)

				if (this.outputObjectURL) {
					URL.revokeObjectURL(this.outputObjectURL)
				}

				this.outputObjectURL = url
				this.outputImage.src = url
				this.outputImageFilename = removed.name
				this.imageResultSection.style.removeProperty("display")
				this.setDirty(false)

				return
			}
		}

		this.showError("No metadata removed.")
	}

	downloadOutputImage() {
		if (this.outputObjectURL && this.outputImageFilename) {
			this.performClickWithUrl(this.outputObjectURL, this.outputImageFilename)
		}
	}

	/**
	 * @param {boolean} dirty
	 */
	setDirty(dirty) {
		if (dirty && !this.dirty) {
			this.dirtyWarning.style.setProperty("display", "block")
		} else if (!dirty && this.dirty) {
			this.dirtyWarning.style.setProperty("display", "none")
		}

		this.dirty = dirty
	}

	markDirty() {
		this.setDirty(true)
	}
}

function main() {
	const layout = new LayoutManager()
	window.currentLayout = layout

	// Initialize ripple
	for (const elem of document.querySelectorAll(".mdc-icon-button")) {
		const ripple = new mdc.ripple.MDCRipple(elem)
		ripple.unbounded = true
	}
	for (const elem of document.querySelectorAll(".mdc-ripple-surface, .mdc-button")) {
		mdc.ripple.MDCRipple.attachTo(elem)
	}

	/** @type {Metadata|null} */
	let currentState = null
	/** @type {string|null} */
	let currentFilename = null
	/** @type {MetadataResult[]|null} */
	let currentMetadataList = null

	const textEncoder = new TextEncoder()

	layout.setProcessFileCallback((file) => {
		file.arrayBuffer()
			.then(async (v) => {
				let newFile = new Uint8Array(v)
				console.log(file.name)

				try {
					currentState = loadMetadata(newFile)
					currentFilename = file.name
					currentMetadataList = currentState.getMetadata()

					window.currentState = currentState
					window.currentFilename = currentFilename

					layout.showInputImage(file)
					layout.setTableData(currentMetadataList)
					layout.showMetadataInfo()
				} catch (e) {
					layout.showError(e)
				}
			})
			.catch(layout.showError.bind(layout))
	})
	layout.setExportCSVCallback(() => {
		if (!currentMetadataList) {
			return null
		}

		const csv = metadataToCSV(currentMetadataList)
		return {
			name: currentFilename + ".csv",
			buffer: textEncoder.encode(csv).buffer
		}
	})
	layout.setMetadataSelectionFunction((level) => {
		/** @type Set<string> */
		const result = new Set()

		if (currentMetadataList && level > 0) {
			for (const md of currentMetadataList) {
				if (md.level > 0 && md.level >= level) {
					result.add(md.id)
				}
			}
		}

		return result
	})
	layout.setRemoveMetadataFunction((selected) => {
		if (currentState && currentFilename) {
			return {
				name: currentFilename,
				buffer: currentState.removeMetadata(selected).buffer,
				mime: currentState.mimeType()
			}
		}

		throw new Error("assertion failed")
	})
}

if (document.readyState !== "loading") {
	main()
} else {
	document.addEventListener("DOMContentLoaded", main)
}
