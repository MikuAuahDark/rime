import { loadMetadata } from "./rime-mod/main.mjs";
import { Metadata } from "./rime-mod/metadata.mjs";

class LayoutManager {
	constructor() {
		/** @type {((file: File) => void)|null} */
		this.processFile = null
		/** @type {string|null} */
		this.inputObjectURL = null
		/** @type {string|null} */
		this.outputObjectURL = null

		/** @type {HTMLDivElement} */
		this.inputArea = document.getElementById("input_area")
		/** @type {HTMLImageElement} */
		this.inputImage = document.getElementById("input_image")
		/** @type {HTMLDivElement} */
		this.inputAreaInfo = document.getElementById("input_area_info")
		/** @type {HTMLInputElement} */
		this.inputFile = document.getElementById("input_file")
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
		/** @type {HTMLAnchorElement} */
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
}

function main() {
	const layout = new LayoutManager()

	// Initialize ripple
	for (const elem of document.querySelectorAll(".mdc-ripple-surface, .mdc-button")) {
		mdc.ripple.MDCRipple.attachTo(elem)
	}

	/** @type {Metadata|null} */
	let currentState = null
	/** @type {string|null} */
	let currentFilename = null

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
				} catch (e) {
					layout.showError(e)
				}
			})
			.catch(layout.showError.bind(layout))
	})
}

if (document.readyState !== "loading") {
	main()
} else {
	document.addEventListener("DOMContentLoaded", main)
}
