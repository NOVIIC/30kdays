import * as Comlink from 'comlink'
import type { SpikeApi } from './worker'

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
const api = Comlink.wrap<SpikeApi>(worker)

const hostImpl = {
  async docRead(name: string) {
    console.log('[host] docRead called with', name)
    return { mockData: true, name }
  },
}

async function run() {
  await api.setHost(Comlink.proxy(hostImpl))
  await api.init()

  const sum = await api.add(2, 3)
  console.log('[main] add(2,3) =', sum)
  if (sum !== 5) throw new Error('add failed')

  const doc = await api.readDocViaHost('memos.json')
  console.log('[main] readDocViaHost =', doc)
  if (!doc || (doc as { mockData?: boolean }).mockData !== true)
    throw new Error('readDocViaHost failed')

  console.log('[main] spike OK — 三层异步链路验证通过')
}

run().catch((e) => console.error('[main] spike FAIL', e))
