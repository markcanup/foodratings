import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function EditRestaurant() {
  const { id } = useParams()
  const [formData, setFormData] = useState({ location: '', cuisine_id: '' })
  const [cuisines, setCuisines] = useState([])
  const [newCuisine, setNewCuisine] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const fetchData = async () => {
      const { data: restaurant } = await supabase.from('restaurants').select('*').eq('id', id).single()
      if (restaurant) {
        setFormData({ location: restaurant.location || '', cuisine_id: restaurant.cuisine_id || '' })
        setRestaurantName(restaurant.name)
      }
      const { data: cuisineData } = await supabase.from('cuisines').select('*')
      setCuisines(cuisineData || [])
    }
    fetchData()
    document.title = 'Restaurant Ratings - Edit Restaurant'
  }, [id])

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
      alert('Error adding cuisine: ' + error.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('restaurants').update(formData).eq('id', id)
    if (error) {
      alert('Error: ' + error.message)
    } else {
      navigate(`/restaurant/${id}`)
    }
  }

  const handleCancel = () => {
    navigate(`/restaurant/${id}`)
  }

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this restaurant and all its dishes and ratings?')) {
      const { data: dishes } = await supabase.from('dishes').select('id').eq('restaurant_id', id)
      const dishIds = dishes.map(d => d.id)
      if (dishIds.length > 0) {
        await supabase.from('ratings').delete().in('dish_id', dishIds)
        await supabase.from('dishes').delete().in('id', dishIds)
      }
      await supabase.from('restaurants').delete().eq('id', id)
      navigate('/')
    }
  }

  return (
    <div>
      <h1>Edit Restaurant</h1>
      <h2>{restaurantName}</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Location:
          <input type="text" name="location" value={formData.location} onChange={handleChange} />
        </label>
        <br />

        <label>
          Cuisine:
          <select name="cuisine_id" value={formData.cuisine_id} onChange={handleChange}>
            <option value="">-- Select Cuisine --</option>
            {cuisines
	      .sort((a, b) => a.name.localeCompare(b.name))
	      .map(c => (
		<option key={c.id} value={c.id}>{c.name}</option>
	      ))}
          </select>
        </label>
        <br />

        <input
          type="text"
          placeholder="New cuisine name"
          value={newCuisine}
          onChange={(e) => setNewCuisine(e.target.value)}
        />
        <button type="button" onClick={handleAddCuisine}>Add Cuisine</button>
        <br />

        <button type="submit">Save</button>
        <button type="button" onClick={handleCancel} style={{ marginLeft: '1rem' }}>Cancel</button>
        <button type="button" onClick={handleDelete} style={{ marginLeft: '1rem', backgroundColor: 'red', color: 'white' }}>Delete</button>
      </form>
    </div>
  )
}

