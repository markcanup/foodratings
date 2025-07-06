import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import MainPage from './components/MainPage'
import AddRestaurant from './components/AddRestaurant'
import ViewRestaurant from './components/ViewRestaurant'
//import AddDish from './components/AddDish'
//import ViewDish from './components/ViewDish'
//import AddRating from './components/AddRating'
//import EditRating from './components/EditRating'
import EditRestaurant from './components/EditRestaurant'
import DishRating from './components/DishRating'

function NewDishRoute() {
  const location = useLocation()

  return (
    <Routes location={location} key={location.key}>
      <Route path="/restaurant/:restaurantId/dish/new" element={<DishRating />} />
    </Routes>
  )
}


function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) alert(`getSession result: ${error.message}`)
      setSession(session)
      setLoading(false)
    }

    initSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  if (loading) return <div>Loading...</div>

  if (!session) {
      alert('No session found - showing login')
      return <Login />
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/add-restaurant" element={<AddRestaurant />} />
        <Route path="/restaurant/:id" element={<ViewRestaurant />} />
        <Route path="/restaurant/:id/edit" element={<EditRestaurant />} />
        <Route path="/restaurant/:restaurantId/add-dish" element={<DishRating />} />
        <Route path="/restaurant/:restaurantId/dish/:dishId" element={<DishRating key={window.location.pathname} />} />
	<Route path="/restaurant/:restaurantId/dish/new" element={<DishRatingWrapper />} />
        <Route path="/dish/:dishId" element={<DishRating />} />
        <Route path="/dish/:dishId/add-rating" element={<DishRating />} />
        <Route path="/dish/:dishId/edit-rating/:ratingId" element={<DishRating />} />
      </Routes>
    </Router>
  )
}

function DishRatingWrapper() {
  const location = useLocation()
  return <DishRating key={location.pathname + location.search} />
}

export default App

