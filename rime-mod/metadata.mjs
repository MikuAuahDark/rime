/**
 * @typedef {{id: string, name: string, value: string, level: number}} MetadataResult
 */

export class Metadata
{
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

	static test() {
		return false
	}
}
