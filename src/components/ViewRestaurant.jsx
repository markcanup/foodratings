import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function ViewRestaurant() {
  const { id } = useParams()
  const [restaurant, setRestaurant] = useState(null)
  const [dishes, setDishes] = useState([])
  const [ratings, setRatings] = useState([])
  const [users, setUsers] = useState([])
  const [filterUserId, setFilterUserId] = useState('')
  const [filterDish, setFilterDish] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showSorts, setShowSorts] = useState(false)
  const [sortOption, setSortOption] = useState('rating')

  useEffect(() => {
    const fetchData = async () => {
      const { data: restaurantData } = await supabase.from('restaurants').select('*').eq('id', id).single()
      setRestaurant(restaurantData)

      const { data: dishData } = await supabase.from('dishes').select('*').eq('restaurant_id', id)
      setDishes(dishData)

      const { data: ratingData } = await supabase
        .from('ratings')
        .select('*, users(*)')
        .in('dish_id', dishData.map(d => d.id))
      setRatings(ratingData)

      const { data: userData } = await supabase.from('users').select('*')
      setUsers(userData)
    }

    fetchData()
  }, [id])

  const ratingsByDish = dishes.reduce((acc, dish) => {
    acc[dish.id] = ratings.filter(r => r.dish_id === dish.id)
    return acc
  }, {})

  const getAverageRatingForDish = (dishId) => {
    const ratings = ratingsByDish[dishId] || []
    const validRatings = ratings.filter(r => typeof r.rating === 'number')
    if (validRatings.length === 0) return null
    const avg = validRatings.reduce((sum, r) => sum + r.rating, 0) / validRatings.length
    return +avg.toFixed(1)
  }

  const getMostRecentRatingDateForDish = (dishId) => {
    const dates = (ratingsByDish[dishId] || [])
      .map(r => r.date_rated)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))
    return dates[0] || null
  }

  const filteredDishes = dishes.filter(d =>
    (!filterUserId || ratingsByDish[d.id]?.some(r => r.user_id === filterUserId)) &&
    (!filterDish || d.name.toLowerCase().includes(filterDish.toLowerCase()))
  )

  const sortedDishes = [...filteredDishes].sort((a, b) => {
    if (sortOption === 'alpha') return a.name.localeCompare(b.name)
    if (sortOption === 'alpha_rev') return b.name.localeCompare(a.name)

    if (sortOption === 'rating') {
      const avgA = getAverageRatingForDish(a.id) || 0
      const avgB = getAverageRatingForDish(b.id) || 0
      return avgB - avgA
    }

    if (sortOption === 'rating_rev') {
      const avgA = getAverageRatingForDish(a.id) || 0
      const avgB = getAverageRatingForDish(b.id) || 0
      return avgA - avgB
    }

    if (sortOption === 'recent') {
      const dateA = new Date(getMostRecentRatingDateForDish(a.id) || 0)
      const dateB = new Date(getMostRecentRatingDateForDish(b.id) || 0)
      return dateB - dateA
    }

    if (sortOption === 'recent_rev') {
      const dateA = new Date(getMostRecentRatingDateForDish(a.id) || 0)
      const dateB = new Date(getMostRecentRatingDateForDish(b.id) || 0)
      return dateA - dateB
    }

    return 0
  })

  return (
    <div>
      <h1>{restaurant?.name}</h1>

      <div style={{ marginTop: '1rem' }}>
        <Link to={`/restaurant/${id}/add-dish`}>+ Add Dish</Link> |{' '}
        <Link to={`/restaurant/${id}/edit`}>Edit Restaurant</Link> |{' '}
        <Link to="#" onClick={(e) => { e.preventDefault(); setShowFilters(prev => !prev) }}>Filter</Link> |{' '}
        <Link to="#" onClick={(e) => { e.preventDefault(); setShowSorts(prev => !prev) }}>Sort</Link>
      </div>

      {showFilters && (
        <div style={{ marginTop: '1rem' }}>
          <label>Filter by person:
            <select value={filterUserId} onChange={e => setFilterUserId(e.target.value)}>
              <option value="">All</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <label style={{ marginLeft: '1rem' }}>Filter by dish:
            <input value={filterDish} onChange={e => setFilterDish(e.target.value)} />
          </label>
        </div>
      )}

      {showSorts && (
        <div style={{ marginTop: '1rem' }}>
          <label>
            Sort by:
            <select value={sortOption} onChange={e => setSortOption(e.target.value)}>
              <option value="alpha">Alphabetical (A–Z)</option>
              <option value="alpha_rev">Alphabetical (Z–A)</option>
              <option value="rating">Average Rating (Best to Worst)</option>
              <option value="rating_rev">Average Rating (Worst to Best)</option>
              <option value="recent">Last Rated (Most to Least Recent)</option>
              <option value="recent_rev">Last Rated (Least to Most Recent)</option>
            </select>
          </label>
        </div>
      )}

    <h2>Dishes</h2>
    {sortedDishes.length === 0 && <p>No matching dishes found.</p>}
      <ul>
        {sortedDishes.map(dish => (
          <li key={dish.id} style={{ marginBottom: '1rem' }}>
            <Link to={`/restaurant/${id}/dish/${dish.id}`}><strong>{dish.name}</strong></Link>
	    {dish.comments && <div><em>{dish.comments}</em></div>}
	    <ul>
              {(ratingsByDish[dish.id] || [])
                .filter(rating => !filterUserId || rating.user_id === filterUserId)
                .map(rating => (
                  <li key={rating.id}>
                    <strong>{rating.users?.name || 'Unknown'}: {rating.rating} ★</strong> ({rating.date_rated})
                    {rating.comments && <><br /><em>{rating.comments}</em></>}
                  </li>
                ))}

	    </ul>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: '2rem' }}>
        <Link to="/">Main Page</Link>
      </div>
    </div>
  )
}

