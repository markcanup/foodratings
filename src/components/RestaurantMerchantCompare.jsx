import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import PageHeader from './PageHeader'
import './admin.css'

const SIMILARITY_THRESHOLD = 0.46

const GROUPS = [
  {
    key: 'associated',
    number: 1,
    title: 'Already associated',
    description: 'Restaurants connected to one or more external merchants.'
  },
  {
    key: 'exact',
    number: 2,
    title: 'Exact name matches',
    description: 'Unassociated restaurants with case-insensitive exact merchant-name matches.'
  },
  {
    key: 'similar',
    number: 3,
    title: 'Similar names',
    description: 'Likely matches based on normalized name similarity.'
  },
  {
    key: 'unmatched',
    number: 4,
    title: 'No suggested match',
    description: 'Restaurants without a strong automatic suggestion; choose a merchant manually.'
  }
]

function exactName(name) {
  return (name || '').trim().toLocaleLowerCase()
}

function normalizedName(name) {
  return exactName(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function bigrams(value) {
  if (value.length < 2) return value ? [value] : []
  return Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2))
}

function diceCoefficient(left, right) {
  if (left === right) return 1
  const leftPairs = bigrams(left)
  const rightPairs = bigrams(right)
  if (leftPairs.length === 0 || rightPairs.length === 0) return 0

  const remaining = new Map()
  rightPairs.forEach(pair => remaining.set(pair, (remaining.get(pair) || 0) + 1))

  let overlap = 0
  leftPairs.forEach(pair => {
    const count = remaining.get(pair) || 0
    if (count > 0) {
      overlap += 1
      remaining.set(pair, count - 1)
    }
  })

  return (2 * overlap) / (leftPairs.length + rightPairs.length)
}

function nameSimilarity(leftName, rightName) {
  const left = normalizedName(leftName)
  const right = normalizedName(rightName)
  if (!left || !right) return 0
  if (left === right) return 1

  const dice = diceCoefficient(left, right)
  const leftTokens = new Set(left.split(' '))
  const rightTokens = new Set(right.split(' '))
  const sharedTokens = [...leftTokens].filter(token => rightTokens.has(token)).length
  const tokenScore = sharedTokens / Math.max(leftTokens.size, rightTokens.size)
  const containmentScore = left.includes(right) || right.includes(left)
    ? Math.min(left.length, right.length) / Math.max(left.length, right.length)
    : 0

  return Math.max(dice, tokenScore, containmentScore)
}

function buildComparisonGroups(restaurants, merchants, associations) {
  const merchantById = new Map(merchants.map(merchant => [merchant.id, merchant]))
  const associationsByRestaurant = new Map()
  const associatedMerchantIds = new Set()

  associations.forEach(association => {
    const merchant = merchantById.get(association.externalMerchantId)
    if (!merchant) return
    associatedMerchantIds.add(merchant.id)
    const linked = associationsByRestaurant.get(association.restaurantId) || []
    linked.push(merchant)
    associationsByRestaurant.set(association.restaurantId, linked)
  })

  const availableMerchants = merchants
    .filter(merchant => !associatedMerchantIds.has(merchant.id))
    .sort((left, right) => left.currentName.localeCompare(right.currentName))

  const groups = { associated: [], exact: [], similar: [], unmatched: [] }

  restaurants
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name))
    .forEach(restaurant => {
      const linkedMerchants = associationsByRestaurant.get(restaurant.id) || []
      if (linkedMerchants.length > 0) {
        groups.associated.push({ restaurant, linkedMerchants, candidates: [] })
        return
      }

      const exactMatches = availableMerchants
        .filter(merchant => exactName(merchant.currentName) === exactName(restaurant.name))
        .map(merchant => ({ merchant, score: 1 }))

      if (exactMatches.length > 0) {
        groups.exact.push({ restaurant, linkedMerchants: [], candidates: exactMatches })
        return
      }

      const similarMatches = availableMerchants
        .map(merchant => ({ merchant, score: nameSimilarity(restaurant.name, merchant.currentName) }))
        .filter(candidate => candidate.score >= SIMILARITY_THRESHOLD)
        .sort((left, right) => right.score - left.score || left.merchant.currentName.localeCompare(right.merchant.currentName))
        .slice(0, 8)

      if (similarMatches.length > 0) {
        groups.similar.push({ restaurant, linkedMerchants: [], candidates: similarMatches })
        return
      }

      groups.unmatched.push({ restaurant, linkedMerchants: [], candidates: [] })
    })

  return { groups, availableMerchants }
}

function MerchantDetails({ merchant, score }) {
  return (
    <span className="merchant-details">
      <span className="merchant-details__name">{merchant.currentName}</span>
      <span className="merchant-details__meta">
        {[merchant.provider, merchant.accountLabel, merchant.currentAddress].filter(Boolean).join(' · ') || 'No address provided'}
      </span>
      {typeof score === 'number' && score < 1 && (
        <span className="match-score">{Math.round(score * 100)}% similar</span>
      )}
    </span>
  )
}

function ManualAssociation({ restaurant, merchants, busyMerchantId, onAssociate }) {
  const [selectedMerchantId, setSelectedMerchantId] = useState('')

  useEffect(() => {
    if (selectedMerchantId && !merchants.some(merchant => merchant.id === selectedMerchantId)) {
      setSelectedMerchantId('')
    }
  }, [merchants, selectedMerchantId])

  if (merchants.length === 0) {
    return <p className="manual-match-empty">No unassociated external merchants remain.</p>
  }

  return (
    <div className="manual-match">
      <label htmlFor={`manual-merchant-${restaurant.id}`}>Choose another merchant</label>
      <div className="manual-match__controls">
        <select
          id={`manual-merchant-${restaurant.id}`}
          value={selectedMerchantId}
          onChange={event => setSelectedMerchantId(event.target.value)}
        >
          <option value="">Select an external merchant…</option>
          {merchants.map(merchant => (
            <option key={merchant.id} value={merchant.id}>
              {merchant.currentName}{merchant.currentAddress ? ` — ${merchant.currentAddress}` : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="secondary-button"
          disabled={!selectedMerchantId || busyMerchantId === selectedMerchantId}
          onClick={async () => {
            const didAssociate = await onAssociate(restaurant.id, selectedMerchantId)
            if (didAssociate) setSelectedMerchantId('')
          }}
        >
          Associate
        </button>
      </div>
    </div>
  )
}

function ComparisonRow({ entry, availableMerchants, busyMerchantId, onAssociate, onRemove }) {
  const { restaurant, linkedMerchants, candidates } = entry

  return (
    <article className="comparison-row">
      <div className="comparison-card restaurant-card">
        <span className="comparison-card__label">Restaurant</span>
        <strong>{restaurant.name}</strong>
        <small>{restaurant.location || 'No location provided'}</small>
      </div>

      <div className="comparison-link" aria-hidden="true">↔</div>

      <div className="comparison-card merchant-card">
        <span className="comparison-card__label">External merchant{linkedMerchants.length + candidates.length === 1 ? '' : 's'}</span>

        {linkedMerchants.map(merchant => (
          <div className="merchant-option merchant-option--linked" key={merchant.id}>
            <MerchantDetails merchant={merchant} />
            <button
              type="button"
              className="text-button text-button--danger"
              disabled={busyMerchantId === merchant.id}
              onClick={() => onRemove(restaurant.id, merchant.id)}
            >
              Remove
            </button>
          </div>
        ))}

        {candidates.map(({ merchant, score }) => (
          <div className="merchant-option" key={merchant.id}>
            <MerchantDetails merchant={merchant} score={score} />
            <button
              type="button"
              disabled={busyMerchantId === merchant.id}
              onClick={() => onAssociate(restaurant.id, merchant.id)}
            >
              Associate
            </button>
          </div>
        ))}

        {linkedMerchants.length === 0 && candidates.length === 0 && (
          <p className="no-suggestion">No automatic match found.</p>
        )}

        <ManualAssociation
          restaurant={restaurant}
          merchants={availableMerchants}
          busyMerchantId={busyMerchantId}
          onAssociate={onAssociate}
        />
      </div>
    </article>
  )
}

export default function RestaurantMerchantCompare() {
  const [restaurants, setRestaurants] = useState([])
  const [merchants, setMerchants] = useState([])
  const [associations, setAssociations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyMerchantId, setBusyMerchantId] = useState('')

  const loadComparison = async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true)
    setError('')

    const { data, error: comparisonError } = await supabase.rpc('admin_restaurant_merchant_comparison')
    if (comparisonError) {
      setError(comparisonError.message)
      setLoading(false)
      return false
    }

    setRestaurants(data?.restaurants || [])
    setMerchants(data?.externalMerchants || [])
    setAssociations(data?.associations || [])
    setLoading(false)
    return true
  }

  useEffect(() => {
    document.title = 'Match Restaurants - Food Ratings Admin'
    loadComparison()
  }, [])

  const { groups, availableMerchants } = useMemo(
    () => buildComparisonGroups(restaurants, merchants, associations),
    [restaurants, merchants, associations]
  )

  const associateMerchant = async (restaurantId, merchantId) => {
    setBusyMerchantId(merchantId)
    setError('')
    setNotice('')
    const { error: associationError } = await supabase.rpc('admin_associate_restaurant_merchant', {
      p_restaurant_id: restaurantId,
      p_external_merchant_id: merchantId
    })

    if (associationError) {
      setError(associationError.message)
      setBusyMerchantId('')
      return false
    }

    await loadComparison({ showLoading: false })
    setBusyMerchantId('')
    setNotice('Association saved.')
    return true
  }

  const removeAssociation = async (restaurantId, merchantId) => {
    setBusyMerchantId(merchantId)
    setError('')
    setNotice('')
    const { error: removeError } = await supabase.rpc('admin_remove_restaurant_merchant_association', {
      p_restaurant_id: restaurantId,
      p_external_merchant_id: merchantId
    })

    if (removeError) {
      setError(removeError.message)
      setBusyMerchantId('')
      return
    }

    await loadComparison({ showLoading: false })
    setBusyMerchantId('')
    setNotice('Association removed.')
  }

  return (
    <main className="merchant-compare-page">
      <PageHeader title="Match restaurants" titleTo="/admin/restaurants" />
      <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Food Ratings</Link>
        <span aria-hidden="true">/</span>
        <Link to="/admin">Admin</Link>
        <span aria-hidden="true">/</span>
        <span>Match restaurants</span>
      </nav>

      <div className="compare-heading">
        <div>
          <p className="admin-eyebrow">Restaurant comparison</p>
          <h2>Connect curated restaurants to imported merchants</h2>
          <p>Each external merchant can belong to one restaurant. A restaurant can include several merchants.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => loadComparison()} disabled={loading}>
          Refresh
        </button>
      </div>

      {notice && <div className="status-message status-message--success" role="status">{notice}</div>}
      {error && (
        <div className="status-message status-message--error" role="alert">
          <strong>Could not load the comparison.</strong>
          <span>{error}</span>
          <small>Confirm the admin association migration has been applied to this Supabase project.</small>
        </div>
      )}

      {loading ? (
        <p className="loading-message">Loading restaurant and merchant data…</p>
      ) : (
        <>
          <div className="compare-summary" aria-label="Comparison summary">
            {GROUPS.map(group => (
              <a href={`#group-${group.key}`} key={group.key}>
                <strong>{groups[group.key].length}</strong>
                <span>{group.title}</span>
              </a>
            ))}
          </div>

          {GROUPS.map(group => (
            <section className="comparison-group" id={`group-${group.key}`} key={group.key}>
              <header className="comparison-group__header">
                <span className="comparison-group__number">{group.number}</span>
                <div>
                  <h3>{group.title}</h3>
                  <p>{group.description}</p>
                </div>
                <span className="comparison-group__count">{groups[group.key].length}</span>
              </header>

              {groups[group.key].length === 0 ? (
                <p className="empty-group">Nothing in this group.</p>
              ) : groups[group.key].map(entry => (
                <ComparisonRow
                  key={entry.restaurant.id}
                  entry={entry}
                  availableMerchants={availableMerchants}
                  busyMerchantId={busyMerchantId}
                  onAssociate={associateMerchant}
                  onRemove={removeAssociation}
                />
              ))}
            </section>
          ))}
        </>
      )}
    </main>
  )
}
