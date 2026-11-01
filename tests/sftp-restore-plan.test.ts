import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { createDeploymentPlan, createRestorePlan } from '../src/lib/website-manifest'

const fixture = process.env.WEBSTUDIO_SFTP_FIXTURE
test.skipIf(!fixture)('compares a real SFTP backup ZIP with its captured destination scan', async () => {
  const backup = await readFile(join(fixture!, 'destination backup.zip'))
  const scan = JSON.parse(await readFile(join(fixture!, 'live destination scan.json'), 'utf8'))
  expect(await createRestorePlan(new Blob([backup]), scan)).toEqual({ added: [], changed: [], removed: [] })
  expect(await createDeploymentPlan(new Blob([backup]), scan, new Blob([backup]))).toEqual({ added: [], changed: [], removed: [] })
})
