export type Logger = {
  error(...message: any[]): void
  warn(...message: any[]): void
  log(...message: any[]): void
  info(...message: any[]): void
  debug(...message: any[]): void
}
