import {mkdir,copyFile} from "node:fs/promises";
await mkdir("apps/web/public",{recursive:true});
await copyFile("node_modules/pdfjs-dist/build/pdf.worker.min.mjs","apps/web/public/pdf.worker.min.mjs");
console.log("PDF worker copied for local browser extraction");
