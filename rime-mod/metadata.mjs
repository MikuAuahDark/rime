/* eslint-disable no-unused-vars */

export class MetadataResult {
	/**
	 * @param {string} id 
	 * @param {string} name 
	 * @param {string} value 
	 * @param {string} description 
	 * @param {number} level 
	 */
	constructor(id, name, value, description, level) {
		this.id = id
		this.name = name
		this.value = value
		this.level = level
		this.description = description
	}
}

export class Metadata {
	/**
	 * @param {Uint8Array} file File to parse.
	 */
	constructor(file) {
	}

	/**
	 * Return list of metadata in the file.
	 * 
	 * It returns array of objects with these fields:
	 * * `id` - Metadata identifier for `removeMetadata` method.
	 * * `name` - Metadata readable name.
	 * * `value` - Metadata value as string.
	 * * `level` - Metadata level. 0 means non-removable, 1 means removable but not recommended, 2 means removable.
	 * 
	 * @returns {MetadataResult[]} List of metadata in the file.
	 */
	getMetadata() {
		throw new Error("need to override getMetadata")
	}

	/**
	 * Remove the list of metadata and return the new file with its selected metadata removed.
	 * 
	 * @param {Set<string>} metadatas List of metadata IDs to be removed.
	 * @returns {Uint8Array} New file with the specified metadata removed.
	 */
	removeMetadata(metadatas) {
		throw new Error("need to override removeMetadata")
	}

	/**
	 * Get MIME type of the parser.
	 * 
	 * @returns {string} MIME type of the parser.
	 */
	mimeType() {
		throw new Error("need to override mimeType")
	}

	static test() {
		return false
	}
}
