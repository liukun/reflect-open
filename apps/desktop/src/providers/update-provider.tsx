import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react'
import { hasBridge } from '@reflect/core'
import { useMainWindowEffect } from '@/hooks/use-main-window-effect'
import {
  createUpdateController,
  type UpdateController,
  type UpdateState,
} from '@/lib/update-controller'
import { useSettings } from '@/providers/settings-provider'

interface UpdateContextValue {
  state: UpdateState
  /**
   * False outside a desktop native shell (browser dev, iOS/Android) — hide
   * update UI entirely. Mobile ships through the app stores, and the updater
   * plugins are only registered under `#[cfg(desktop)]`.
   */
  supported: boolean
  checkNow: () => Promise<void>
  install: () => Promise<void>
  restart: () => Promise<void>
}

const UpdateContext = createContext<UpdateContextValue | null>(null)

const IDLE: UpdateState = { phase: 'idle' }

interface UpdateProviderProps {
  children: ReactNode
  /**
   * Override the launch + periodic check. When unset the provider follows the
   * `updateAutoCheck` setting (on by default), gated by "packaged desktop
   * build" — `tauri dev` would otherwise prompt to "update" to the released
   * version. Tests pass an explicit boolean to freeze the behavior.
   */
  autoCheck?: boolean
}

/**
 * Thin React shim over {@link createUpdateController} (Plan 15): one
 * controller for the app's lifetime, surfaced through `useSyncExternalStore`.
 * Mounted above the graph gate so update checks run from first launch, before
 * any graph is open.
 */
export function UpdateProvider({ children, autoCheck }: UpdateProviderProps): ReactElement {
  const supported = hasBridge()
  const { settings } = useSettings()
  // Prop override wins for tests; otherwise obey the user's `updateAutoCheck`
  // preference — but still short-circuit outside a packaged desktop build so
  // dev prompts don't fire.
  const resolvedAutoCheck =
    autoCheck ?? (supported && !import.meta.env.DEV && settings.updateAutoCheck)
  const [controller, setController] = useState<UpdateController | null>(null)

  // One checker per app: secondary note windows never poll for updates.
  useMainWindowEffect(() => {
    if (!supported) {
      return
    }
    const next = createUpdateController({ autoCheck: resolvedAutoCheck })
    // The controller is an imperative lifecycle object created for the app's
    // lifetime; it must be instantiated in an effect (it subscribes and starts)
    // and stored so useSyncExternalStore can read it.
    setController(next)
    next.start()
    return () => {
      next.dispose()
      setController((current) => (current === next ? null : current))
    }
  }, [supported, resolvedAutoCheck])

  const state = useSyncExternalStore(
    controller?.subscribe ?? (() => () => {}),
    controller?.getState ?? (() => IDLE),
  )

  const value = useMemo<UpdateContextValue>(
    () => ({
      state,
      supported,
      checkNow: () => controller?.checkNow() ?? Promise.resolve(),
      install: () => controller?.install() ?? Promise.resolve(),
      restart: () => controller?.restart() ?? Promise.resolve(),
    }),
    [controller, state, supported],
  )

  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>
}

/** Update state + actions; must be used under an {@link UpdateProvider}. */
export function useUpdate(): UpdateContextValue {
  const value = useContext(UpdateContext)
  if (value === null) {
    throw new Error('useUpdate must be used within an UpdateProvider')
  }
  return value
}
