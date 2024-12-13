import { BunRuntime } from '@effect/platform-bun'
import { type Logger as PyBridgeLogger, PyBridge } from '@voice-agent-example/pybridge'
import { Effect, identity, Logger, Runtime } from 'effect'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { layerLlamaIndex } from './llama-index-adapter.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface StartOptions {
  log_level?: string
  drain_timeout?: number
  devmode: boolean
}

interface API {
  start(opt?: StartOptions): void
}

const makePyBridgeLogger: Effect.Effect<PyBridgeLogger> = Effect.gen(function*() {
  const runtime = yield* Effect.runtime()
  const runSync = Runtime.runSync(runtime)

  const createLogMethod = (logf: typeof Effect.logDebug) => (...message: any[]) =>
    runSync(logf(...message))

  const logger: PyBridgeLogger = {
    debug: createLogMethod(Effect.logDebug),
    info: createLogMethod(Effect.logInfo),
    log: createLogMethod(Effect.log),
    warn: createLogMethod(Effect.logWarning),
    error: createLogMethod(Effect.logError),
  }

  return logger
})

const program = Effect.gen(function*() {
  yield* Effect.logInfo('Voice Agent program initialized')
  yield* Effect.logInfo(`Running in ${Bun.env.NODE_ENV || 'development'} mode`)
  yield* Effect.logInfo(`Current directory: ${__dirname}`)

  yield* Effect.logInfo('Initializing PyBridge...')
  const pyBridgeLogger = yield* makePyBridgeLogger
  const bridge = yield* Effect.sync(() =>
    new PyBridge({ python: 'python3', cwd: __dirname }, pyBridgeLogger)
  )
  yield* Effect.logInfo('PyBridge initialized successfully')

  yield* Effect.logInfo('Creating API controller...')
  const api = yield* Effect.sync(() => bridge.controller<API>('main.py'))

  yield* Effect.logInfo('API controller created successfully')

  yield* Effect.promise(() =>
    api.start(
      {
        ...(Bun.env.LOG_LEVEL ? { log_level: Bun.env.LOG_LEVEL } : {}),
        devmode: Bun.env.NODE_ENV !== 'production',
      },
    )
  )

  yield* Effect.never
}).pipe(
  Effect.tapDefect((c) => Effect.logFatal('FATAL ERROR: An unrecoverable error occurred', c)),
  Bun.env.NODE_ENV === 'production' ? Effect.provide(Logger.json) : Effect.map(identity),
  Effect.provide(layerLlamaIndex),
  Effect.scoped,
)

BunRuntime.runMain(program, { disablePrettyLogger: Bun.env.NODE_ENV === 'production' })
