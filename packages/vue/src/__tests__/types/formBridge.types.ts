import type { VueSchemxInstance } from "../../index"
import type { SchemxInstance } from "@schemx/core"

interface FormValues {
  name: string
}

declare const instance: VueSchemxInstance<FormValues>

const coreCompatibleForm: SchemxInstance<FormValues> = instance

instance.setFieldValue("name", (previous) => previous ?? "")

void coreCompatibleForm
