import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import PageHeader from './PageHeader'
import './admin.css'

export default function AdminPage() {
  const [access, setAccess] = useState('checking')

  useEffect(() => {
    document.title = 'Admin - Food Ratings'

    const checkAccess = async () => {
      const { data, error } = await supabase.rpc('is_app_admin')
      setAccess(!error && data === true ? 'allowed' : 'denied')
    }

    checkAccess()
  }, [])

  return (
    <main className="admin-page">
      <PageHeader title="Admin" titleTo="/admin" />
      <Link to="/" className="admin-back-link">← Back to Food Ratings</Link>

      {access === 'checking' && <p className="loading-message">Checking admin access…</p>}

      {access === 'denied' && (
        <div className="status-message status-message--error" role="alert">
          <strong>Admin access is required.</strong>
          <span>Your signed-in account is not on the app admin allowlist.</span>
        </div>
      )}

      {access === 'allowed' && (
        <>
          <section className="admin-intro">
            <p className="admin-eyebrow">Data tools</p>
            <h2>Bring imported order history into focus</h2>
            <p>
              Compare curated Food Ratings records with imported provider data, then create the
              associations that future reporting and cleanup tools will use.
            </p>
          </section>

          <div className="admin-launch-grid">
            <Link to="/admin/restaurants" className="admin-launch-card">
              <span className="admin-launch-card__icon" aria-hidden="true">↔</span>
              <span>
                <strong>Match restaurants</strong>
                <small>Compare restaurants with external merchants and save associations.</small>
              </span>
              <span className="admin-launch-card__arrow" aria-hidden="true">→</span>
            </Link>
          </div>
        </>
      )}
    </main>
  )
}
