import {mkdir,copyFile} from "node:fs/promises";
import {createRequire} from 'node:module';
// Resolve from the consuming workspace, including filtered/nested workspace installs.
const require=createRequire(new URL('../apps/web/package.json',import.meta.url));
const target=new URL('../apps/web/public/',import.meta.url);
await mkdir(target,{recursive:true});
await copyFile(require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'),new URL('pdf.worker.min.mjs',target));
console.log("PDF worker copied for browser extraction");
