import { useId, type ReactElement } from 'react'
import { ArrowDownToLine, RefreshCw, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useSettings } from '@/providers/settings-provider'
import { useUpdate } from '@/providers/update-provider'

/**
 * The manual path to the same updater the app checks on launch: one button
 * whose label tracks the update lifecycle, with the outcome reported inline.
 * The row also hosts the "automatic update checks" switch — the setting and
 * the on-demand button belong on the same line because the switch is
 * literally *"whether that button runs on a timer"*.
 */
export function UpdateField(): ReactElement {
  const { state, checkNow, install, restart } = useUpdate()
  const { settings, updateSettings } = useSettings()
  const labelId = useId()
  const descriptionId = useId()

  const action: {
    label: string
    icon: typeof RefreshCw
    run?: (() => Promise<void>) | undefined
    spinning?: boolean | undefined
  } = (() => {
    switch (state.phase) {
      case 'checking':
        return { label: 'Checking…', icon: RefreshCw, run: undefined, spinning: true }
      case 'available':
        return { label: `Install ${state.version}`, icon: ArrowDownToLine, run: install }
      case 'downloading':
        return {
          label: `Downloading${state.percent !== null ? ` ${state.percent}%` : '…'}`,
          icon: ArrowDownToLine,
          run: undefined,
        }
      case 'ready':
        return { label: 'Restart to update', icon: RotateCw, run: restart }
      case 'error':
        // Retry what actually failed: a failed install still has its found
        // update (same contract as the sidebar row); a failed check re-checks.
        return state.during === 'install'
          ? { label: 'Retry install', icon: ArrowDownToLine, run: install }
          : { label: 'Check for updates', icon: RefreshCw, run: checkNow }
      default:
        return { label: 'Check for updates', icon: RefreshCw, run: checkNow }
    }
  })()

  const run = action.run
  return (
    <fieldset className="px-4 py-3.5" aria-labelledby={labelId} aria-describedby={descriptionId}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div id={labelId} className="text-sm font-medium text-text">
            Updates
          </div>
          <p id={descriptionId} className="mt-0.5 text-xs text-text-muted">
            Automatically check for new versions on launch and every few hours, and show a prompt
            when one is available. Turn off to silence updates — the button below still lets you
            check on demand.
          </p>
        </div>
        <Switch
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
          checked={settings.updateAutoCheck}
          onCheckedChange={(checked) => updateSettings({ updateAutoCheck: checked })}
          className="shrink-0"
        />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={run === undefined}
          onClick={run ? () => void run() : undefined}
          className="text-text-secondary"
        >
          <action.icon
            aria-hidden
            strokeWidth={1.75}
            className={action.spinning ? 'animate-spin' : undefined}
          />
          {action.label}
        </Button>
        {state.phase === 'upToDate' ? (
          <span role="status" className="text-xs text-text-muted">
            You're up to date.
          </span>
        ) : null}
        {state.phase === 'error' ? (
          <span role="alert" className="text-xs text-red-500">
            {state.message}
          </span>
        ) : null}
      </div>
    </fieldset>
  )
}
