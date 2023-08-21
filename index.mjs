import { loadMetadata } from "./rime-mod/main.mjs";
import { Metadata } from "./rime-mod/metadata.mjs";

function main() {
	/** @type {HTMLDivElement} */
	let inputArea = document.getElementById("input_area")
	/** @type {HTMLInputElement} */
	let inputFile = document.getElementById("input_file")
	/** @type {HTMLDivElement} */
	let errorAlert = document.getElementById("error_alert")

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

		let divAlert = document.createElement("div")
		divAlert.classList.add("uk-alert-danger")
		divAlert.setAttribute("uk-alert", "")

		let closeButton = document.createElement("a")
		closeButton.classList.add("uk-alert-close")
		closeButton.setAttribute("uk-close", "")

		let header = document.createElement("h3")
		header.textContent = "An Error Occured!"

		let text = document.createElement("p")
		text.textContent = msg

		divAlert.replaceChildren(closeButton, header, text)
		errorAlert.replaceChildren(divAlert)
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
		inputArea.classList.add("uk-dragover")
		e.stopPropagation()
		e.preventDefault()
	})
	inputArea.addEventListener("dragleave", (e) => {
		inputArea.classList.remove("uk-dragover")
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
		inputArea.classList.remove("uk-dragover")

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
