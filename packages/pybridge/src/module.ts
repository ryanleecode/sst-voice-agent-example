import { createModule, onAppShutdown } from '@deepkit/app'
import { PyBridge } from './bridge.js'
import { PyBridgeConfig } from './config.js'

export class PyBridgeModule extends createModule({
  config: PyBridgeConfig,
  providers: [PyBridge],
  exports: [PyBridge],
}) {
  override process() {
    this.addListener(
      onAppShutdown.listen((event, python: PyBridge) => {
        // disconnect all open python processes when app shuts down
        python.close()
      }),
    )
  }
}
