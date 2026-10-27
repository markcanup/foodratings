import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import RestaurantRatingSelector from './RestaurantRatingSelector'
import './restaurant-form.css'

function merchantOptionLabel(merchant) {
  const details = [merchant.currentAddress, merchant.provider, merchant.accountLabel].filter(Boolean)
  return `${merchant.currentName}${details.length > 0 ? ` — ${details.join(' · ')}` : ''}`
}

export default function AddRestaurant() {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    cuisine_id: '',
    comments: '',
    rating: ''
  })
  const [cuisines, setCuisines] = useState([])
  const [newCuisine, setNewCuisine] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [externalMerchants, setExternalMerchants] = useState([])
  const [selectedMerchantId, setSelectedMerchantId] = useState('')
  const [merchantsLoading, setMerchantsLoading] = useState(false)
  const [merchantError, setMerchantError] = useState('')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchFormOptions = async () => {
      const [cuisineResult, adminResult] = await Promise.all([
        supabase.from('cuisines').select('*').order('name'),
        supabase.rpc('is_app_admin')
      ])

      setCuisines(cuisineResult.data || [])
      const hasAdminAccess = !adminResult.error && adminResult.data === true
      setIsAdmin(hasAdminAccess)
      if (!hasAdminAccess) return

      setMerchantsLoading(true)
      const { data, error } = await supabase.rpc('admin_unmatched_external_merchants')
      if (error) {
        setMerchantError(error.message)
      } else {
        setExternalMerchants(data || [])
      }
      setMerchantsLoading(false)
    }
    fetchFormOptions()
    document.title = 'Restaurant Ratings - Add Restaurant'
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleAddCuisine = async () => {
    if (!newCuisine.trim()) return
    const { data, error } = await supabase.from('cuisines').insert([{ name: newCuisine }]).select()
    if (!error && data?.length > 0) {
      const newEntry = data[0]
      setCuisines(prev => [...prev, newEntry])
      setFormData(prev => ({ ...prev, cuisine_id: newEntry.id }))
      setNewCuisine('')
    } else {
      alert('Error adding cuisine: ' + (error?.message || 'Unknown error'))
    }
  }

  const handleMerchantChange = (event) => {
    const merchantId = event.target.value
    setSelectedMerchantId(merchantId)
    setMerchantError('')
    const merchant = externalMerchants.find(entry => entry.id === merchantId)
    if (merchant) {
      setFormData(previous => ({
        ...previous,
        name: merchant.currentName,
        location: merchant.currentAddress || ''
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const restaurant = {
      name: formData.name.trim(),
      location: formData.location.trim() || null,
      cuisine_id: formData.cuisine_id || null,
      comments: formData.comments.trim() || null,
      rating: formData.rating === '' ? null : Number(formData.rating)
    }
    const { data, error } = selectedMerchantId
      ? await supabase.rpc('admin_create_restaurant_from_external_merchant', {
          p_external_merchant_id: selectedMerchantId,
          p_cuisine_id: restaurant.cuisine_id,
          p_comments: restaurant.comments,
          p_rating: restaurant.rating
        })
      : await supabase.from('restaurants').insert([restaurant]).select()

    if (error) {
      alert('Error: ' + error.message)
    } else {
      const newId = selectedMerchantId ? data : data[0].id
      navigate(`/restaurant/${newId}`)
    }
    setSaving(false)
  }

  return (
    <div className="restaurant-form-page">
      <h1>Add Restaurant</h1>
      <form onSubmit={handleSubmit}>
        {isAdmin && (
          <section className="external-merchant-source">
            <h2>Add from imported merchant</h2>
            <p>Select an unmatched merchant to copy its name and address and link it to the new restaurant.</p>
            <label htmlFor="external-merchant">External merchant (optional)</label>
            <select
              id="external-merchant"
              value={selectedMerchantId}
              onChange={handleMerchantChange}
              disabled={merchantsLoading || saving}
            >
              <option value="">Add a restaurant manually</option>
              {externalMerchants.map(merchant => (
                <option key={merchant.id} value={merchant.id}>
                  {merchantOptionLabel(merchant)}
                </option>
              ))}
            </select>
            {merchantsLoading && <small>Loading unmatched merchants…</small>}
            {!merchantsLoading && externalMerchants.length === 0 && !merchantError && (
              <small>All imported merchants are already linked.</small>
            )}
            {merchantError && <small className="external-merchant-source__error">{merchantError}</small>}
          </section>
        )}

        <label>
          Name:
          <input type="text" name="name" value={formData.name} onChange={handleChange} disabled={Boolean(selectedMerchantId)} required />
        </label>
        <label>
          Location (optional):
          <input type="text" name="location" value={formData.location} onChange={handleChange} disabled={Boolean(selectedMerchantId)} />
        </label>
        {selectedMerchantId && <span className="field-help">Name and location come from the selected external merchant.</span>}

        <label>
          Cuisine:
          <select name="cuisine_id" value={formData.cuisine_id} onChange={handleChange}>
            <option value="">-- Select Cuisine --</option>
            {cuisines.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <input
          type="text"
          placeholder="New cuisine name"
          value={newCuisine}
          onChange={(e) => setNewCuisine(e.target.value)}
        />
        <button type="button" onClick={handleAddCuisine}>Add Cuisine</button>

        <label>
          Comments (optional):
          <textarea name="comments" value={formData.comments} onChange={handleChange} />
        </label>

        <RestaurantRatingSelector
          value={formData.rating}
          onChange={(rating) => setFormData(prev => ({ ...prev, rating }))}
        />

        <div className="restaurant-form-actions">
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button type="button" className="secondary-button" disabled={saving} onClick={() => navigate('/')}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
