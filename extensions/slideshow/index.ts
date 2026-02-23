import type { AnyAgentTool, OpenClawPluginApi } from "../../src/plugins/types.js";
import { createSlideshowTool } from "./src/slideshow-tool.js";

export default function register(api: OpenClawPluginApi) {
  api.registerTool(createSlideshowTool(api) as unknown as AnyAgentTool, { optional: true });
}
