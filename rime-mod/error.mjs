export class RIMEError extends Error {
	/**
	 * @param {string} short
	 * @param {string} long
	 */
	constructor(short, long) {
		super(short)
		this.longMessage = long
	}
}

export class FileUnsupportedError extends RIMEError {
	/**
	 * @param {string[]} other
	 */
	constructor(other) {
		super("File Unsupported", "The file you try to load is currently not supported by RIME: " + other.join(", "))
	}
}

export class MalformedTIFFError extends RIMEError {
	constructor() {
		super(
			"Invalid TIFF Header",
			"This indicates a corrupted file. If the image file opens perfectly in image editors, it could be a " +
			"bug in RIME."
		)
	}
}

export class NoEXIFError extends RIMEError {
	constructor() {
		super("No EXIF Data Present", "This indicates that there are no (EXIF) metadata present in the image.")
	}
}
