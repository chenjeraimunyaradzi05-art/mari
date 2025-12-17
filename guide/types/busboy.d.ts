declare module 'busboy' {
  import { EventEmitter } from 'events'
  interface BusboyConfig {
    headers?: any
  }
  class Busboy extends EventEmitter {
    constructor(config?: BusboyConfig)
    on(event: 'file', listener: (fieldname: string, file: NodeJS.ReadableStream, filename: string, encoding: string, mimetype: string) => void): this
    on(event: 'field', listener: (fieldname: string, val: string) => void): this
    on(event: 'finish', listener: () => void): this
    write(chunk: Buffer | string): void
    end(chunk?: Buffer | string): void
  }
  export = Busboy
}
