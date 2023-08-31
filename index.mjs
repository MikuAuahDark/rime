import { loadMetadata } from "./rime-mod/main.mjs";
import { Metadata } from "./rime-mod/metadata.mjs";

function main() {

	/** @type {HTMLDivElement} */
	let inputArea = document.getElementById("input_area")
	/** @type {HTMLImageElement} */
	let inputImage = document.getElementById("input_image")
	/** @type {HTMLDivElement} */
	let inputAreaInfo = document.getElementById("input_area_info")
	/** @type {HTMLInputElement} */
	let inputFile = document.getElementById("input_file")
	/** @type {HTMLElement} */
	let metadataInfoListSection = document.getElementById("metadata_info_list")
	/** @type {HTMLTableElement} */
	let metadataListTable = document.getElementById("metadata_list_table")
	/** @type {HTMLTableSectionElement} */
	let metadataListTableBody = document.getElementById("metadata_list")
	/** @type {HTMLButtonElement} */
	let removeMetadataButton = document.getElementById("remove_metadata")
	/** @type {HTMLElement} */
	let imageResultSection = document.getElementById("image_result")
	/** @type {HTMLImageElement} */
	let outputImage = document.getElementById("output_image")
	/** @type {HTMLAnchorElement} */
	let downloadImageButton = document.getElementById("download_image")

	// Initialize styles
	let errorAlert = new mdc.snackbar.MDCSnackbar(document.querySelector(".mdc-snackbar"))
	let metadataListTableMDC = new mdc.dataTable.MDCDataTable(metadataListTable)
	window.metadataTable = metadataListTableMDC

	// Initialize top bar
	let topBar = new mdc.topAppBar.MDCTopAppBar(document.querySelector(".mdc-top-app-bar"))
	// Initialize ripple
	for (const elem of document.querySelectorAll(".mdc-ripple-surface, .mdc-button")) {
		mdc.ripple.MDCRipple.attachTo(elem)
	}

	/** @type {Metadata|null} */
	let currentState = null
	/** @type {string|null} */
	let currentFilename = null

	function showError(message) {
		let msg = ""
		if (message instanceof Error) {
			msg = message.message
		} else {
			msg = toString(message)
		}

		errorAlert.labelText = msg
		errorAlert.open()
	}

	/**
	 * @param {File} file 
	 */
	function processFile(file) {
		file.arrayBuffer().then((v) => {
			let newFile = new Uint8Array(v)
			console.log(file.name)

			try {
				currentState = loadMetadata(newFile)
				currentFilename = file.name

				// TODO: Show image
			} catch (e) {
				showError(e)
			}
		}, showError)
	}

	// Define events for inputArea
	inputArea.addEventListener("click", () => {
		inputFile.click()
	})
	inputArea.addEventListener("dragenter", (e) => {
		inputArea.classList.add("mdc-elevation--z12")
		inputArea.classList.remove("mdc-elevation--z1")
		e.stopPropagation()
		e.preventDefault()
	})
	inputArea.addEventListener("dragleave", (e) => {
		inputArea.classList.add("mdc-elevation--z1")
		inputArea.classList.remove("mdc-elevation--z12")
		e.stopPropagation()
		e.preventDefault()
	})
	inputArea.addEventListener("dragover", (e) => {
		e.stopPropagation()
		e.preventDefault()
	})
	inputArea.addEventListener("drop", (e) => {
		e.stopPropagation()
		e.preventDefault()
		inputArea.classList.add("mdc-elevation--z1")
		inputArea.classList.remove("mdc-elevation--z12")

		if (e.dataTransfer.items) {
			for (const item of e.dataTransfer.items) {
				if (item.kind == "file") {
					const file = item.getAsFile()
					processFile(file)
					break
				}
			}
		} else {
			for (const file of e.dataTransfer.files) {
				processFile(file)
				break
			}
		}
	})

	// Define events for inputFile
	inputFile.addEventListener("change", (e) => {
		e.preventDefault()
		if (inputFile.files) {
			for (const file of inputFile.files) {
				processFile(file)
				break
			}
		}

		inputFile.value = null
	})
}

if (document.readyState !== "loading") {
	main();
} else {
	document.addEventListener("DOMContentLoaded", main);
}
