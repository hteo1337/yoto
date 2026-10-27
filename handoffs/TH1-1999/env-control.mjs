import assert from 'node:assert/strict'
import {createServer} from 'vite'
const vite = await createServer({configFile:false,server:{middlewareMode:true}})
const beforeAuth = process.env.YOTO_AUTH_SECRET
const beforeTs = process.env.TS_AUTHKEY
try {
  process.env.YOTO_AUTH_SECRET = 'synthetic-parent-control'
  process.env.TS_AUTHKEY = 'synthetic-parent-control'
  assert.ok(process.env.YOTO_AUTH_SECRET && process.env.TS_AUTHKEY)
  const {getSandbox} = await vite.ssrLoadModule('/selfhost/shims/sandbox.ts')
  const sandbox = getSandbox(null,'adversarial-env-control')
  const result = await sandbox.exec('test -z "${YOTO_AUTH_SECRET+x}" && test -z "${TS_AUTHKEY+x}" && printf absent')
  assert.equal(result.success,true)
  assert.equal(result.stdout,'absent')
  await sandbox.destroy()
  process.stdout.write('ENV CONTROL PASS: both synthetic keys present in parent, both absent in child; no values printed\n')
} finally {
  if(beforeAuth===undefined) delete process.env.YOTO_AUTH_SECRET; else process.env.YOTO_AUTH_SECRET=beforeAuth
  if(beforeTs===undefined) delete process.env.TS_AUTHKEY; else process.env.TS_AUTHKEY=beforeTs
  await vite.close()
}
