RIME
=====

An Image Metadata Reader and Remover that performs everything in your browser.

This is the academy research branch for research. If you're looking for the latest features and bugfixes, check out
the [master](https://github.com/MikuAuahDark/rime/tree/master) branch. Any pull request submitted into academy branch
will be rejected.

Usage (Browser)
-----

Main source: `index.html`.

https://MikuAuahDark.github.io/rime/academy/index.html

Usage (Node.js)
-----

Example

```js
import * as process from "node:process"
import * as fs from "node:fs"
import { loadMetadata } from "./rime-mod/main.mjs"

if (process.argv.length < 3) {
	console.log("usage: %s %s <image>", process.argv[0], process.argv[1])
	process.exit(1)
}

const imageFile = fs.readFileSync(process.argv[2])
const metadata = loadMetadata(new Uint8Array(imageFile))
console.log(metadata.getMetadata())
```

License
-----

MIT.
