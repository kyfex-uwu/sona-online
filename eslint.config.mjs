// @ts-check

import js from "@eslint/js";
import {defineConfig} from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig({
    files:["src/**.ts","main.js","dev.js"],
    extends:[js.configs.recommended, tseslint.configs.strict]
})