import type { CreateFormOptions, SchemxInstance } from "../../index"

interface FormValues {
  name: string
}

const options: CreateFormOptions<FormValues> = {
  onReset: () => {},
  onLoadingChange: (loading) => {
    const loadingState: boolean = loading

    void loadingState
  },
}

declare const form: SchemxInstance<FormValues>

const loading: boolean = form.isLoading()

void options
void loading
