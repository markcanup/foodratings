import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function AddRestaurant() {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    cuisine_id: ''
  })
  const [cuisines, setCuisines] = useState([])
  const [newCuisine, setNewCuisine] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const fetchCuisines = async () => {
      const { data } = await supabase.from('cuisines').select('*').order('name')
      setCuisines(data || [])
    }
    fetchCuisines()
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
      alert('Error adding cuisine: ' + error.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { data, error } = await supabase.from('restaurants').insert([formData]).select()
    if (error) {
      alert('Error: ' + error.message)
    } else {
      const newId = data[0].id
      navigate(`/restaurant/${newId}`)
    }
  }

  return (
    <div>
      <h1>Add Restaurant</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Name:
          <input type="text" name="name" value={formData.name} onChange={handleChange} required />
        </label>
        <br />

        <label>
          Location (optional):
          <input type="text" name="location" value={formData.location} onChange={handleChange} />
        </label>
        <br />

        <label>
          Cuisine:
          <select name="cuisine_id" value={formData.cuisine_id} onChange={handleChange}>
            <option value="">-- Select Cuisine --</option>
            {cuisines.map(c => (
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
      </form>
    </div>
  )
}

