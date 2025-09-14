import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function MainPage() {
  const [restaurants, setRestaurants] = useState([])
  const [dishes, setDishes] = useState([])
  const [ratings, setRatings] = useState([])
  const [users, setUsers] = useState([])
  const [cuisines, setCuisines] = useState([])

  maybeClearOldPrefs()

  const [selectedUserId, setSelectedUserId] = useState(getPref('prefSelectedUserId', ''))
  const [dishFilter, setDishFilter] = useState(getPref('prefDishFilter', ''))
  const [restaurantFilter, setRestaurantFilter] = useState(getPref('prefRestaurantFilter', ''))
  const [selectedCuisineId, setSelectedCuisineId] = useState(getPref('prefSelectedCuisineId', ''))
  const [showFilters, setShowFilters] = useState(false)
  const [showSorts, setShowSorts] = useState(false)
  const [showDisplayOptions, setShowDisplayOptions] = useState(false)
  const [sortOption, setSortOption] = useState(getPref('prefSortOption', 'alpha'))
  const [displayMode, setDisplayMode] = useState(getPref('prefDisplayMode', 'summary'))

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  useEffect(() => {
    document.title = 'Restaurant Ratings - Main Page'

    const fetchData = async () => {
      const { data: restData } = await supabase.from('restaurants').select('*')
      const { data: dishData } = await supabase.from('dishes').select('*')
      const { data: ratingData } = await supabase.from('ratings').select('*, users:users!ratings_user_id_fkey (id, name)')
      const { data: userData } = await supabase.from('users').select('*')
      const { data: cuisineData } = await supabase.from('cuisines').select('*')

      setRestaurants(restData)
      setDishes(dishData)
      setRatings(ratingData)
      setUsers(userData)
      setCuisines(cuisineData)
    }

    fetchData()
  }, [])

  const getAverageRating = (restaurantId) => {
    const dishIds = dishes.filter(d => d.restaurant_id === restaurantId).map(d => d.id)
    const restaurantRatings = ratings.filter(r => dishIds.includes(r.dish_id) && typeof r.rating === 'number')
    if (restaurantRatings.length === 0) return null
    const sum = restaurantRatings.reduce((acc, r) => acc + r.rating, 0)
    return +(sum / restaurantRatings.length).toFixed(1)
  }

  const getMostRecentRatingDate = (restaurantId) => {
    const dishIds = dishes.filter(d => d.restaurant_id === restaurantId).map(d => d.id)
    const dates = ratings
      .filter(r => dishIds.includes(r.dish_id))
      .map(r => r.date_rated)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))
    return dates.length > 0 ? dates[0] : null
  }

  const getRatingsBreakdown = (restaurantId) => {
    const dishList = dishes.filter(d => d.restaurant_id === restaurantId)
    const breakdown = {}
    users.forEach(u => { breakdown[u.id] = {} })
    ratings.forEach(r => {
      const dish = dishList.find(d => d.id === r.dish_id)
      if (dish) {
        const personRatings = breakdown[r.users?.id]
        if (personRatings) {
          personRatings[r.rating] = (personRatings[r.rating] || 0) + 1
        }
      }
    })
    return breakdown
  }

  const filteredRestaurants = restaurants
    .filter(r => {
      if (restaurantFilter && !r.name.toLowerCase().includes(restaurantFilter.toLowerCase())) return false
      if (selectedCuisineId && r.cuisine_id !== selectedCuisineId) return false
      const dishesInRest = dishes.filter(d => d.restaurant_id === r.id)
      if (dishFilter && !dishesInRest.some(d => d.name.toLowerCase().includes(dishFilter.toLowerCase()))) return false
      if (selectedUserId) {
        const ratedDishIds = ratings.filter(rt => rt.user_id === selectedUserId).map(rt => rt.dish_id)
        const restaurantDishIds = dishesInRest.map(d => d.id)
        if (!restaurantDishIds.some(id => ratedDishIds.includes(id))) return false
      }
      return true
    })
    .sort((a, b) => {
      const avgA = parseFloat(getAverageRating(a.id) || 0)
      const avgB = parseFloat(getAverageRating(b.id) || 0)
      const dateA = new Date(getMostRecentRatingDate(a.id) || 0)
      const dateB = new Date(getMostRecentRatingDate(b.id) || 0)

      switch (sortOption) {
        case 'alpha': return a.name.localeCompare(b.name)
        case 'alpha_rev': return b.name.localeCompare(a.name)
        case 'rating': return avgB - avgA
        case 'rating_rev': return avgA - avgB
        case 'recent': return dateB - dateA
        case 'recent_rev': return dateA - dateB
        default: return 0
      }
    })

  let lastLetter = '';
  return (
    <div>
    <div className="top-controls">
      <h1>Restaurant Ratings</h1>
      <div style={{ marginTop: '1rem' }}>
        <Link to="/add-restaurant">+ Add Restaurant</Link> |{' '}
        <Link to="#" onClick={(e) => { e.preventDefault(); setShowFilters(p => !p) }}>Filter</Link> |{' '}
        <Link to="#" onClick={(e) => { e.preventDefault(); setShowSorts(p => !p) }}>Sort</Link> |{' '}
        <Link to="#" onClick={(e) => { e.preventDefault(); setShowDisplayOptions(p => !p) }}>Display</Link>
      </div>

      {showSorts && (
        <div style={{ marginTop: '1rem' }}>
          <label>Sort by:
            <select value={sortOption} onChange={e => {
		setSortOption(e.target.value)
		localStorage.setItem('prefSortOption', e.target.value)
		setShowSorts(false)
	    }}>
              <option value="alpha">Alphabetical (A-Z)</option>
              <option value="alpha_rev">Alphabetical (Z-A)</option>
              <option value="rating">Restaurant Rating (Best to Worst)</option>
              <option value="rating_rev">Restaurant Rating (Worst to Best)</option>
              <option value="recent">Last Rated (Most to Least Recent)</option>
              <option value="recent_rev">Last Rated (Least to Most Recent)</option>
            </select>
          </label>
        </div>
      )}

      {showDisplayOptions && (
        <div style={{ marginTop: '1rem' }}>
          <label>Display mode:
            <select value={displayMode} onChange={e => {
		setDisplayMode(e.target.value)
		localStorage.setItem('prefDisplayMode', e.target.value)
		setShowDisplayOptions(false)
	    }}>
              <option value="summary">Rating Summary</option>
              <option value="dishes">Dish List</option>
              <option value="bare">Bare</option>
            </select>
          </label>
        </div>
      )}

      {showFilters && (
        <div style={{ marginTop: '1rem' }}>
          <label>Filter by person:
            <select value={selectedUserId} onChange={e => {
		setSelectedUserId(e.target.value)
		localStorage.setItem('prefSelectedUserId', e.target.value)
		setShowFilters(false)
	    }}>
              <option value="">-- All --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
          <br />

          <label>Filter by dish name:
            <input
              type="text"
              value={dishFilter}
              onChange={e => {
		  setDishFilter(e.target.value)
		  localStorage.setItem('prefDishFilter', e.target.value)
		  //setShowFilters(false)
	      }}
              placeholder="Search dishes"
            />
          </label>
          <br />

          <label>Filter by cuisine:
            <select value={selectedCuisineId} onChange={e => {
		setSelectedCuisineId(e.target.value)
		localStorage.setItem('prefSelectedCuisineId', e.target.value)
		setShowFilters(false)
	    }}>
              <option value="">-- All --</option>
              {cuisines
		.sort((a, b) => a.name.localeCompare(b.name))
		.map(c => (
		  <option key={c.id} value={c.id}>{c.name}</option>
		))}
            </select>
          </label>
          <br />

          <label>Filter by restaurant name:
            <input
              type="text"
              value={restaurantFilter}
              onChange={e => {
		  setRestaurantFilter(e.target.value)
		  localStorage.setItem('prefRestaurantFilter', e.target.value)
		  //setShowFilters(false)
	      }}
              placeholder="Search restaurants"
            />
          </label>
        </div>
      )}

      <div style={{ marginTop: '2rem', marginBottom: '1rem', fontSize: '80%' }}>
	{alphabet.map(letter => (
	  <a
	    key={letter}
	    href={`#letter-${letter}`}
	    style={{ marginRight: '0.5rem' }}
	  >
	    {letter}
	  </a>
	))}
      </div>
    </div>

      <h2>Search Results</h2>
      {filteredRestaurants.length === 0 && <p>No matching restaurants found.</p>}
      <ul>
        {filteredRestaurants.map(r => {
          const average = getAverageRating(r.id)
          const mostRecent = getMostRecentRatingDate(r.id)
          const breakdown = getRatingsBreakdown(r.id)
          const restaurantDishes = dishes.filter(d => d.restaurant_id === r.id)
	  const firstLetter = r.name[0].toUpperCase();
	  const showLetterAnchor = firstLetter !== lastLetter;
	  if (showLetterAnchor) lastLetter = firstLetter;

          return (
            <li key={r.id} style={{ marginBottom: '1rem', scrollMarginTop: '180px' }} id={showLetterAnchor ? `letter-${firstLetter}` : undefined}>
              <Link to={`/restaurant/${r.id}`}>
                <strong>{r.name}</strong>
              </Link>
              {average && <span style={{ marginLeft: '1rem' }}>{average}★</span>}
              {mostRecent && <span style={{ marginLeft: '1rem', fontStyle: 'italic' }}>({mostRecent})</span>}

              {displayMode === 'summary' && (
                <ul>
                  {users.map(u => {
                    const userBreakdown = breakdown[u.id]
                    const entries = Object.entries(userBreakdown || {})
                      .sort((a, b) => b[0] - a[0])
                      .map(([stars, count]) => `${stars}★ (${count})`)
                    return entries.length > 0 && (
                      <li key={u.id}>{u.name}: {entries.join(', ')}</li>
                    )
                  })}
                </ul>
              )}

	      {displayMode === 'dishes' && (
		<ul>
		  {restaurantDishes
		    .filter(d => !dishFilter || d.name.toLowerCase().includes(dishFilter.toLowerCase()))
		    .sort((a, b) => a.name.localeCompare(b.name))
		    .map(d => {
		      const dishRatings = ratings
			.filter(r => r.dish_id === d.id && typeof r.rating === 'number')
			.map(r => r.rating)
		      const uniqueRatings = [...new Set(dishRatings)].sort((a, b) => b - a)
		      const ratingSummary = uniqueRatings.map(stars => `${stars} ★`).join(' and ')
		      return (
			<li key={d.id}>
			  <Link to={`/restaurant/${r.id}/dish/${d.id}`}>{d.name}</Link>
			  {ratingSummary && <span style={{ marginLeft: '0.5rem', color: '#666' }}>– {ratingSummary}</span>}
			</li>
		      )
		    })}
		</ul>
	      )}

            </li>
          )
        })}
      </ul>
    </div>
  )
}

function maybeClearOldPrefs() {
  const lastVisit = localStorage.getItem('lastVisitTimestamp');
  const now = Date.now();
  const THIRTY_MINUTES = 30 * 60 * 1000;

  if (!lastVisit || now - parseInt(lastVisit) > THIRTY_MINUTES) {
    localStorage.removeItem('prefSortOption');
    localStorage.removeItem('prefSelectedUserId');
    localStorage.removeItem('prefDishFilter');
    localStorage.removeItem('prefRestaurantFilter');
    localStorage.removeItem('prefSelectedCuisineId');
  }

  localStorage.setItem('lastVisitTimestamp', now.toString());
}

function getPref(key, defaultValue) 
{
    return localStorage.getItem(key) || defaultValue
}
