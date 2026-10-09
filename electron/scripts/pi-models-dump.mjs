import { builtinModels } from "@browser_use/pi"

const models = builtinModels()

for (const provider of ["openai", "anthropic", "google", "xai"]) {
  const list = models.getModels(provider)
  console.log(`\n== ${provider} (${list.length} models) ==`)
  for (const m of list) {
    const id = m.id
    const input = Array.isArray(m.input) ? m.input.join(",") : String(m.input ?? "?")
    const vision = input.includes("image")
    if (vision) {
      console.log(`${provider}/${id}\treasoning=${Boolean(m.reasoning)}\t${input}\tctx=${m.contextWindow}`)
    }
  }
}