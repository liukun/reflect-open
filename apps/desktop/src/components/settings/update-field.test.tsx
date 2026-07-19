import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UpdateState } from '@/lib/update-controller'
import { UpdateField } from './update-field'

const update = vi.hoisted(() => ({
  state: { phase: 'idle' } as UpdateState,
  supported: true,
  checkNow: vi.fn(async () => {}),
  install: vi.fn(async () => {}),
  restart: vi.fn(async () => {}),
}))
vi.mock('@/providers/update-provider', () => ({ useUpdate: () => update }))

const settings = vi.hoisted(() => ({
  data: { updateAutoCheck: true },
  updateSettings: vi.fn<(patch: { updateAutoCheck?: boolean }) => void>(),
}))
vi.mock('@/providers/settings-provider', () => ({
  useSettings: () => ({ settings: settings.data, updateSettings: settings.updateSettings }),
}))

afterEach(() => {
  update.checkNow.mockClear()
  update.install.mockClear()
  settings.data = { updateAutoCheck: true }
  settings.updateSettings.mockClear()
})

describe('UpdateField', () => {
  it('retries the install after an install failure — the found update is still there', async () => {
    update.state = { phase: 'error', message: 'signature verification failed', during: 'install' }
    await render(<UpdateField />)
    expect(page.getByRole('alert').element().textContent).toMatch(/signature verification failed/)
    await userEvent.click(page.getByRole('button', { name: 'Retry install' }))
    expect(update.install).toHaveBeenCalledTimes(1)
    expect(update.checkNow).not.toHaveBeenCalled()
  })

  it('re-checks after a check failure', async () => {
    update.state = { phase: 'error', message: 'release endpoint unreachable', during: 'check' }
    await render(<UpdateField />)
    await userEvent.click(page.getByRole('button', { name: 'Check for updates' }))
    expect(update.checkNow).toHaveBeenCalledTimes(1)
    expect(update.install).not.toHaveBeenCalled()
  })

  it('toggles the automatic-checks setting from the inline switch', async () => {
    await render(<UpdateField />)
    const toggle = page.getByRole('switch', { name: 'Updates' })
    await expect.element(toggle).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(toggle)
    expect(settings.updateSettings).toHaveBeenCalledWith({ updateAutoCheck: false })
  })

  it('reflects the setting state on the switch', async () => {
    settings.data = { updateAutoCheck: false }
    await render(<UpdateField />)
    await expect
      .element(page.getByRole('switch', { name: 'Updates' }))
      .toHaveAttribute('aria-checked', 'false')
  })
})
