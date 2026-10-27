import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

function formatTime(value) {
  return value ? new Date(value).toLocaleString() : ''
}

export default function PostmatesSync() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(false)
  const [error, setError] = useState('')

  const loadStatus = useCallback(async () => {
    const { data, error: statusError } = await supabase.rpc('admin_external_sync_status', {
      p_provider: 'postmates'
    })

    if (statusError) {
      setError(statusError.message)
    } else {
      setStatus(data)
      setError('')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (!['queued', 'running'].includes(status?.request?.state)) return undefined
    const timer = window.setInterval(loadStatus, 2500)
    return () => window.clearInterval(timer)
  }, [loadStatus, status?.request?.state])

  const requestSync = async () => {
    setRequesting(true)
    setError('')
    const { error: requestError } = await supabase.rpc('admin_request_external_sync', {
      p_provider: 'postmates'
    })

    if (requestError) setError(requestError.message)
    else await loadStatus()
    setRequesting(false)
  }

  const request = status?.request
  const active = ['queued', 'running'].includes(request?.state)

  return (
    <section className="sync-card" aria-labelledby="postmates-sync-title">
      <div>
        <p className="admin-eyebrow">Order import</p>
        <h3 id="postmates-sync-title">Postmates sync</h3>
        <p>
          Ask the server helper to scan order history. Orders already in Food Ratings are
          skipped; only new provider order IDs are imported.
        </p>
      </div>

      {loading && <p className="sync-card__status">Checking sync status…</p>}

      {!loading && status?.configured === false && (
        <div className="status-message status-message--error" role="alert">
          <strong>Postmates is not configured.</strong>
          <span>Import the initial account before requesting an app sync.</span>
        </div>
      )}

      {!loading && status?.configured && (
        <div className="sync-card__controls">
          <div className="sync-card__status" aria-live="polite">
            <strong>{status.accountLabel}</strong>
            {!request && <span>No app-triggered sync has run yet.</span>}
            {request?.state === 'queued' && <span>Sync requested {formatTime(request.requestedAt)}. Waiting for the helper…</span>}
            {request?.state === 'running' && <span>Reading Postmates history and checking for new orders…</span>}
            {request?.state === 'complete' && (
              <span>
                Last completed {formatTime(request.completedAt)} · {request.newOrderCount ?? 0} new order{request.newOrderCount === 1 ? '' : 's'}
              </span>
            )}
            {request?.state === 'failed' && <span>Last sync failed: {request.error}</span>}
          </div>
          <button type="button" onClick={requestSync} disabled={requesting || active}>
            {requesting ? 'Requesting…' : active ? 'Sync in progress…' : 'Sync Postmates now'}
          </button>
        </div>
      )}

      {error && (
        <div className="status-message status-message--error" role="alert">
          <strong>Could not sync Postmates.</strong>
          <span>{error}</span>
        </div>
      )}
    </section>
  )
}
