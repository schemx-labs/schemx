import { getCoreForm, type VueSchemxInstance } from "../../index"

import type { SchemxInstance } from "@schemx/core"

interface FormValues {
  name: string
}

declare const facade: VueSchemxInstance<FormValues>

const coreCompatibleForm: SchemxInstance<FormValues> = facade

const coreForm = getCoreForm(facade)

void coreCompatibleForm
void coreForm
