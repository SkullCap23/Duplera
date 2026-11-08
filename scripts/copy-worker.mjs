import {mkdir,copyFile} from "node:fs/promises";
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const target=new URL('../apps/web/public/',import.meta.url);
await mkdir(target,{recursive:true});
await copyFile(require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'),new URL('pdf.worker.min.mjs',target));
console.log("PDF worker copied for browser extraction");
