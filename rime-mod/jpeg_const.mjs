// FF D9, FF DA, FF DB, FF DC, FF DD, FF DE, FF DF
export const MARKER_INVALID = new Set([0xD9, 0xDA, 0xDB, 0xDC, 0xDD, 0xDE, 0xDF])
// EXIF\0\0
export const EXIF_IDENTIFIER = [69, 88, 73, 70, 0, 0]
// EXIF IFD ID
export const EXIF_IFD_ID = 0x8769
// EXIF GPS IFD ID
export const GPS_IFD_ID = 0x8825
// EXIF Interopability IFD
export const INTEROP_IFD_ID = 0xA005
