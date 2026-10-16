import { createFormComponent } from "@schemx/vue"

import { schemx } from "./schemx"

export default createFormComponent(schemx.createForm, "ElementPlusSchemxForm")
