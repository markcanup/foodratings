import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import RestaurantRatingSelector from './RestaurantRatingSelector'
import './restaurant-form.css'

const EMPTY_FORM = {
  name: '',
  location: '',
  cuisine_id: '',
  comments: '',
  rating: ''
}

export default function EditRestaurant() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [cuisines, setCuisines] = useState([])
  const [newCuisine, setNewCuisine] = useState('')
  const [calculatedRating, setCalculatedRating] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [linkedMerchants, setLinkedMerchants] = useState([])
  const [availableMerchants, setAvailableMerchants] = useState([])
  const [selectedMerchantId, setSelectedMerchantId] = useState('')
  const [linkageLoading, setLinkageLoading] = useState(false)
  const [busyMerchantId, setBusyMerchantId] = useState('')
  const [linkageError, setLinkageError] = useState('')
  const [linkageNotice, setLinkageNotice] = useState('')

  const loadLinkages = useCallback(async () => {
    setLinkageLoading(true)
    setLinkageError('')
    const { data, error } = await supabase.rpc('admin_restaurant_linkages', {
      p_restaurant_id: id
    })

    if (error) {
      setLinkageError(error.message)
    } else {
      setLinkedMerchants(data?.linkedMerchants || [])
      setAvailableMerchants(data?.availableMerchants || [])
      setSelectedMerchantId(current => (
        data?.availableMerchants?.some(merchant => merchant.id === current) ? current : ''
      ))
    }
    setLinkageLoading(false)
  }, [id])

  useEffect(() => {
    const fetchData = async () => {
      const [
        { data: restaurant, error: restaurantError },
        { data: cuisineData, error: cuisineError },
        { data: adminAccess }
      ] = await Promise.all([
        supabase
          .from('restaurants')
          .select('*, dishes(ratings(rating))')
          .eq('id', id)
          .single(),
        supabase.from('cuisines').select('*').order('name'),
        supabase.rpc('is_app_admin')
      ])

      if (restaurantError) {
        alert('Error loading restaurant: ' + restaurantError.message)
        return
      }

      if (restaurant) {
        const dishRatings = (restaurant.dishes || [])
          .flatMap(dish => dish.ratings || [])
          .map(rating => rating.rating)
          .filter(rating => typeof rating === 'number')

        setFormData({
          name: restaurant.name || '',
          location: restaurant.location || '',
          cuisine_id: restaurant.cuisine_id || '',
          comments: restaurant.comments || '',
          rating: restaurant.rating ?? ''
        })
        setCalculatedRating(dishRatings.length > 0
          ? +(dishRatings.reduce((sum, rating) => sum + rating, 0) / dishRatings.length).toFixed(1)
          : null)
      }

      if (cuisineError) {
        alert('Error loading cuisines: ' + cuisineError.message)
      } else {
        setCuisines(cuisineData || [])
      }

      const hasAdminAccess = adminAccess === true
      setIsAdmin(hasAdminAccess)
      if (hasAdminAccess) await loadLinkages()
    }

    fetchData()
    document.title = 'Restaurant Ratings - Edit Restaurant'
  }, [id, loadLinkages])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData(previous => ({ ...previous, [name]: value }))
  }

  const handleAddCuisine = async () => {
    if (!newCuisine.trim()) return
    const { data, error } = await supabase
      .from('cuisines')
      .insert([{ name: newCuisine.trim() }])
      .select()

    if (!error && data?.length > 0) {
      const newEntry = data[0]
      setCuisines(previous => [...previous, newEntry])
      setFormData(previous => ({ ...previous, cuisine_id: newEntry.id }))
      setNewCuisine('')
    } else {
      alert('Error adding cuisine: ' + (error?.message || 'Unknown error'))
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const restaurant = {
      name: formData.name.trim(),
      location: formData.location.trim() || null,
      cuisine_id: formData.cuisine_id || null,
      comments: formData.comments.trim() || null,
      rating: formData.rating === '' ? null : Number(formData.rating)
    }
    const { error } = await supabase.from('restaurants').update(restaurant).eq('id', id)
    if (error) {
      alert('Error: ' + error.message)
    } else {
      navigate(`/restaurant/${id}`)
    }
  }

  const handleAssociate = async () => {
    if (!selectedMerchantId) return
    setBusyMerchantId(selectedMerchantId)
    setLinkageError('')
    setLinkageNotice('')

    const { error } = await supabase.rpc('admin_associate_restaurant_merchant', {
      p_restaurant_id: id,
      p_external_merchant_id: selectedMerchantId
    })

    if (error) {
      setLinkageError(error.message)
    } else {
      await loadLinkages()
      setLinkageNotice('Merchant linked.')
    }
    setBusyMerchantId('')
  }

  const handleRemoveLinkage = async (merchantId) => {
    setBusyMerchantId(merchantId)
    setLinkageError('')
    setLinkageNotice('')

    const { error } = await supabase.rpc('admin_remove_restaurant_merchant_association', {
      p_restaurant_id: id,
      p_external_merchant_id: merchantId
    })

    if (error) {
      setLinkageError(error.message)
    } else {
      await loadLinkages()
      setLinkageNotice('Merchant link removed.')
    }
    setBusyMerchantId('')
  }

  const syncName = (merchant) => {
    setFormData(previous => ({ ...previous, name: merchant.currentName }))
    setLinkageError('')
    setLinkageNotice(`Name changed to “${merchant.currentName}”. Save the restaurant to keep this change.`)
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this restaurant and all its dishes and ratings?')) return

    const { data: dishes } = await supabase.from('dishes').select('id').eq('restaurant_id', id)
    const dishIds = (dishes || []).map(dish => dish.id)
    if (dishIds.length > 0) {
      await supabase.from('ratings').delete().in('dish_id', dishIds)
      await supabase.from('dishes').delete().in('id', dishIds)
    }
    await supabase.from('restaurants').delete().eq('id', id)
    navigate('/')
  }

  return (
    <div className="restaurant-form-page">
      <h1>Edit Restaurant</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Name:
          <input type="text" name="name" value={formData.name} onChange={handleChange} required />
        </label>

        {linkedMerchants.length === 0 ? (
          <label>
            Location (optional):
            <input type="text" name="location" value={formData.location} onChange={handleChange} />
          </label>
        ) : (
          <span className="field-help">Location is hidden while external merchants are linked; their addresses appear below.</span>
        )}

        <label>
          Cuisine:
          <select name="cuisine_id" value={formData.cuisine_id} onChange={handleChange}>
            <option value="">-- Select Cuisine --</option>
            {cuisines.map(cuisine => (
              <option key={cuisine.id} value={cuisine.id}>{cuisine.name}</option>
            ))}
          </select>
        </label>

        <input
          type="text"
          placeholder="New cuisine name"
          value={newCuisine}
          onChange={(event) => setNewCuisine(event.target.value)}
        />
        <button type="button" onClick={handleAddCuisine}>Add Cuisine</button>

        <label>
          Comments (optional):
          <textarea name="comments" value={formData.comments} onChange={handleChange} />
        </label>

        <RestaurantRatingSelector
          value={formData.rating}
          calculatedRating={calculatedRating}
          onChange={(rating) => setFormData(previous => ({ ...previous, rating }))}
        />

        {isAdmin && (
          <section className="restaurant-linkages">
            <h3>Linkages</h3>
            <p>Connect this restaurant to external merchants. Link changes are saved immediately.</p>

            {linkageLoading && <p className="restaurant-linkages__status">Loading merchants…</p>}
            {!linkageLoading && linkedMerchants.length === 0 && (
              <p className="restaurant-linkages__status">No external merchants are linked.</p>
            )}

            {linkedMerchants.map(merchant => (
              <div className="restaurant-linkages__merchant" key={merchant.id}>
                <div>
                  <strong>{merchant.currentName}</strong>
                  <small>{merchant.currentAddress || 'No address provided'}</small>
                  <small>{[merchant.provider, merchant.accountLabel].filter(Boolean).join(' · ')}</small>
                </div>
                <div className="restaurant-linkages__merchant-actions">
                  <button type="button" className="secondary-button" onClick={() => syncName(merchant)}>
                    Sync Name
                  </button>
                  <button
                    type="button"
                    className="remove-button"
                    disabled={busyMerchantId === merchant.id}
                    onClick={() => handleRemoveLinkage(merchant.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            <div className="restaurant-linkages__add">
              <select
                aria-label="External merchant to link"
                value={selectedMerchantId}
                onChange={(event) => setSelectedMerchantId(event.target.value)}
              >
                <option value="">Select an external merchant…</option>
                {availableMerchants.map(merchant => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.currentName}{merchant.currentAddress ? ` — ${merchant.currentAddress}` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedMerchantId || busyMerchantId === selectedMerchantId}
                onClick={handleAssociate}
              >
                Link Merchant
              </button>
            </div>

            {linkageNotice && <p className="restaurant-linkages__status">{linkageNotice}</p>}
            {linkageError && <p className="restaurant-linkages__error">{linkageError}</p>}
          </section>
        )}

        <div className="restaurant-form-actions">
          <button type="submit">Save</button>
          <button type="button" className="secondary-button" onClick={() => navigate(`/restaurant/${id}`)}>Cancel</button>
          <button type="button" className="danger-button" onClick={handleDelete}>Delete</button>
        </div>
      </form>
    </div>
  )
}
