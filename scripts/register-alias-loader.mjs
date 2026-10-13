// Bootstrap passed via `node --import`: registers alias-loader.mjs's resolve
// hook on Node's ESM loader thread. (A loader module's hooks only take
// effect when wired up with module.register(); simply --import-ing the
// hooks file does nothing on its own.)
import { register } from "node:module"

register("./alias-loader.mjs", import.meta.url)
