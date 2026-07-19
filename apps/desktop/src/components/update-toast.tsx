import { useEffect, type ReactElement } from 'react'
import { toast } from 'sonner'
import { useSettings } from '@/providers/settings-provider'
import { useUpdate } from '@/providers/update-provider'

const UPDATE_TOAST_ID = 'reflect-update'
const PERSISTENT_TOAST_MS = Number.POSITIVE_INFINITY
const NON_DISMISSIBLE_UPDATE_OPTIONS = {
  closeButton: false,
  dismissible: false,
}

function runToastAction(action: () => Promise<void>): void {
  void action().catch((error: unknown) => {
    console.error('update toast action failed:', error)
  })
}

/** Mirrors the auto-update lifecycle into the global Sonner notification surface. */
export function UpdateToast(): ReactElement | null {
  const { state, install, restart } = useUpdate()
  const { settings } = useSettings()
  // `updateAutoCheck` is the user's "no update prompts" switch: when off, the
  // provider also stops auto-checking, but a manual "Check for updates" (from
  // the settings field) still transitions state — we suppress its toast here
  // to honor the preference for both entry points, and dismiss whatever is
  // already showing when the setting flips off mid-session.
  const toastsEnabled = settings.updateAutoCheck

  useEffect(() => {
    if (!toastsEnabled) {
      toast.dismiss(UPDATE_TOAST_ID)
      return
    }
    switch (state.phase) {
      case 'available':
        toast.message('Update available', {
          id: UPDATE_TOAST_ID,
          description: `Reflect ${state.version} is ready to install.`,
          duration: PERSISTENT_TOAST_MS,
          ...NON_DISMISSIBLE_UPDATE_OPTIONS,
          action: {
            label: 'Install',
            onClick: () => runToastAction(install),
          },
        })
        break
      case 'downloading':
        toast.loading('Downloading update', {
          id: UPDATE_TOAST_ID,
          description: state.percent !== null ? `${state.percent}%` : 'Preparing…',
          duration: PERSISTENT_TOAST_MS,
          // Sonner merges options into the existing toast by id, so the
          // "Install" action from the `available` phase persists unless we
          // clear it — otherwise a clickable Install button lingers over the
          // download progress. The update only becomes installable once it has
          // fully downloaded, surfaced as "Restart" in the `ready` phase.
          action: undefined,
          ...NON_DISMISSIBLE_UPDATE_OPTIONS,
        })
        break
      case 'ready':
        toast.success('Update ready', {
          id: UPDATE_TOAST_ID,
          description: `Reflect ${state.version} will finish updating after restart.`,
          duration: PERSISTENT_TOAST_MS,
          ...NON_DISMISSIBLE_UPDATE_OPTIONS,
          action: {
            label: 'Restart',
            onClick: () => runToastAction(restart),
          },
        })
        break
      case 'error':
        if (state.during === 'install') {
          toast.error('Update failed', {
            id: UPDATE_TOAST_ID,
            description: state.message,
            duration: PERSISTENT_TOAST_MS,
            ...NON_DISMISSIBLE_UPDATE_OPTIONS,
            action: {
              label: 'Retry install',
              onClick: () => runToastAction(install),
            },
          })
        } else {
          toast.dismiss(UPDATE_TOAST_ID)
        }
        break
      default:
        toast.dismiss(UPDATE_TOAST_ID)
        break
    }
  }, [install, restart, state, toastsEnabled])

  return null
}
