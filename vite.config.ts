import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Builds to one self-contained dist/index.html.
export default defineConfig({ plugins: [viteSingleFile()] });
