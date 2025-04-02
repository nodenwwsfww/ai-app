import type { PlasmoCSConfig } from "plasmo"
import {
    injectGhostTextStyles
} from "~contents-helpers/web";

export const config: PlasmoCSConfig = {
    matches: ["<all_urls>"],
}
injectGhostTextStyles()

