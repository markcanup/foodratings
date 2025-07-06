import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function DishRating() {
  const { restaurantId, dishId } = useParams()
  const navigate = useNavigate()

  const [dish, setDish] = useState(null)
  const [ratings, setRatings] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const hasInitialized = useRef(false)

  useEffect(() => {
    const isNew = dishId === 'new';
    if (isNew) {
      createNewDish();
    }
  }, [window.location.search])  // triggers on ?ts= change

  // First: Create a new dish if needed
  useEffect(() => {
    if (dishId || hasInitialized.current) return
    hasInitialized.current = true
    document.title = 'Restaurant Ratings - Add Dish/Rating'

    const createNewDish = async () => {
      const { data: newDish, error } = await supabase
	.from('dishes')
	.insert({ name: '', comments: '', restaurant_id: restaurantId })
	.select()
	.single()

      if (error) {
	console.error('Error creating new dish:', error.message)
	alert(`There was a problem creating a new dish: ${error.message} Please try again.`)
	return
      }
      navigate(`/restaurant/${restaurantId}/dish/${newDish.id}`, { replace: true })
    }
    createNewDish()
  }, [dishId, restaurantId, navigate])

  // Second: Load data if dishId is present
  useEffect(() => {
    const loadData = async () => {
      if (!dishId) return // Do not run if dishId isn't available
      document.title = 'Restaurant Ratings - Edit Dish/Rating'
      setLoading(true)

      const [{ data: usersData }, { data: dishData }, { data: ratingsData }] = await Promise.all([
	supabase.from('users').select('*'),
	supabase.from('dishes').select('*').eq('id', dishId).single(),
	supabase.from('ratings').select('*').eq('dish_id', dishId),
      ])

      setUsers(usersData || [])
      setDish(dishData || null)
      // If there are no ratings, create a blank one
      if (!ratingsData || ratingsData.length === 0) {
	const savedDate = localStorage.getItem('lastSelectedDate')
	const defaultDate = savedDate || new Date().toISOString().split('T')[0]
	setRatings([{
	  user_id: usersData?.[0]?.id?.toString() || '',
	  rating: '',
	  comments: '',
	  date_rated: defaultDate
	}])
      } else {
	setRatings(ratingsData)
      }
//      setRatings(ratingsData || [])
      setLoading(false)
    }

    loadData()
  }, [dishId])

  const updateDishField = async (field, value) => {
    const updatedDish = { ...dish, [field]: value }
    setDish(updatedDish)
    await supabase.from('dishes').update(updatedDish).eq('id', dish.id)
  }

  const handleDishChange = async (field, value) => {
    const updatedDish = { ...dish, [field]: value }
    setDish(updatedDish)
    if (dishId) {
      const { error } = await supabase
	.from('dishes')
	.update({ [field]: value })
	.eq('id', dishId)
      if (error) {
	console.error('Error updating dish:', error)
	alert(`There was a problem saving the dish: ${error.message}. Please try again.`)
      }
    }
  }

  const handleRatingChange = async (index, field, value) => {
    const updatedRatings = [...ratings]
    updatedRatings[index] = { ...updatedRatings[index], [field]: value }
    setRatings(updatedRatings)

    const rating = updatedRatings[index]

    try {
      if (rating.id) {
	const { error } = await supabase
	  .from('ratings')
	  .update(rating)
	  .eq('id', rating.id)

	if (error) throw error
      } else {
	const insertData = {
	  ...rating,
	  dish_id: dish.id,
	  rating: rating.rating ? parseInt(rating.rating) : null,
	  user_id: rating.user_id || null,
	  date_rated: rating.date_rated || null,
	  comments: rating.comments || null
	}
	const { data, error } = await supabase
	  .from('ratings')
	  .insert(insertData)
	  .select()
	  .single()

	if (error) throw error

	updatedRatings[index] = data
	setRatings(updatedRatings)
      }
      if (rating.date_rated) {
	localStorage.setItem('lastSelectedDate', rating.date_rated)
      }
    } catch (err) {
      console.error('Error saving rating:', err, rating)
      alert(`There was a problem saving the rating: ${err.message}. Please try again.`)
    }
  }

  async function handleDeleteImage() {
    if (!dish || !dish.image_url) return

    // Get the filename from the URL (e.g., "myimage.jpg")
    const urlParts = dish.image_url.split('/')
    const imageFilename = urlParts[urlParts.length - 1]

    // 1. Remove from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from('dish-images')
      .remove([`public/${imageFilename}`])

    if (storageError) {
      alert('Failed to delete image from storage.')
      console.error(storageError)
      return
    }

    // 2. Remove the URL from the dishes table
    const { error: dbError } = await supabase
      .from('dishes')
      .update({ image_url: null })
      .eq('id', dish.id)

    if (dbError) {
      alert('Failed to update dish record.')
      console.error(dbError)
      return
    }

    // 3. Update UI
    setDish((prev) => ({ ...prev, image_url: null }))
  }


  const addRating = () => {
    const savedDate = localStorage.getItem('lastSelectedDate')
    const defaultDate = savedDate || new Date().toISOString().split('T')[0]
    setRatings([...ratings, {
      user_id: users.length > 0 ? users[0].id.toString() : '',
      rating: '',
      comments: '',
      date_rated: defaultDate
    }])
  }

  const deleteRating = async (index) => {
    const rating = ratings[index]
    if (rating.id) {
      await supabase.from('ratings').delete().eq('id', rating.id)
    }
    const newRatings = ratings.filter((_, i) => i !== index)
    setRatings(newRatings)
  }

  const deleteDish = async () => {
    await supabase.from('ratings').delete().eq('dish_id', dish.id)
    await supabase.from('dishes').delete().eq('id', dish.id)
    navigate(`/restaurant/${dish.restaurant_id}`)
  }

  const descriptions = {
    1: 'Disgusting (threw away)',
    2: "Don't order again",
    3: 'Fine',
    4: 'Pretty Good',
    5: 'Favorite'
  }

    //alert(window.location.pathname)
  if (loading) return <div>Loading...</div>
  if (!dish && dishId) return <div>Dish not found</div>

  return (
    <div>
      <h2>Dish</h2>

      <input
        type="text"
        value={dish.name || ''}
	onChange={(e) => handleDishChange('name', e.target.value)}
        placeholder="Dish Name"
      />

      <textarea
	value={dish.comments || ''}
	onChange={(e) => handleDishChange('comments', e.target.value)}
	placeholder="Dish comments (e.g., adds/removes)"
	style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
      />

      <h4>Dish Image</h4>

      {dish.image_url && (
	<img src={dish.image_url} alt="Dish" style={{ maxWidth: '300px', marginBottom: '1rem' }} />
      )}
      {dish.image_url && (
	<button onClick={handleDeleteImage}>
	    Delete Image
	</button>
      )}

      <input
	type="file"
	accept="image/*"
	onChange={async (e) => {
	  const file = e.target.files[0];
	  if (!file) return;

	  const fileExt = file.name.split('.').pop();
	  const fileName = `${dish.id}-${Date.now()}.${fileExt}`;
	  const filePath = `${fileName}`;

	  let { error: uploadError } = await supabase.storage
	    .from('dish-images')
	    .upload(filePath, file);

	  if (uploadError) {
	    console.error('Upload error:', uploadError);
	    alert(`Error uploading image.: ${uploadError.message}`);
	    return;
	  }

	  const { data: { publicUrl } } = supabase.storage
	    .from('dish-images')
	    .getPublicUrl(filePath);

	  const { error: updateError } = await supabase
	    .from('dishes')
	    .update({ image_url: publicUrl })
	    .eq('id', dish.id);

	  if (updateError) {
	    console.error('Error saving image URL to dish:', updateError);
	    alert('Error saving image reference.');
	  } else {
	    setDish({ ...dish, image_url: publicUrl });
	  }
	}}
      />


      <h3>Ratings</h3>
      {ratings.map((rating, index) => (
	<div
	  key={index}
	  style={{
	    border: '1px solid #ccc',
	    borderRadius: '8px',
	    padding: '1rem',
	    marginBottom: '1rem',
	    backgroundColor: '#f9f9f9'
	  }}
	>

          <select
            value={rating.user_id || ''}
            onChange={(e) => handleRatingChange(index, 'user_id', e.target.value)}
          >
            <option value="">Select User</option>
            {users.map((u) => (
              <option key={u.id} value={u.id.toString()}>{u.name}</option>
            ))}
          </select>

	  <div style={{ margin: '1rem 0' }}>
	    <label><strong>Rating</strong></label>
	    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
	      {[1, 2, 3, 4, 5].map(value => (
		<button
		  type="button"
		  key={value}
		  onClick={() => handleRatingChange(index, 'rating', value)}
		  style={{
		    textAlign: 'left',
		    padding: '0.5rem',
		    backgroundColor: parseInt(rating.rating) === value ? '#007BFF' : '#eee',
		    color: parseInt(rating.rating) === value ? '#fff' : '#000',
		    border: '1px solid #ccc',
		    borderRadius: '4px',
		    cursor: 'pointer'
		  }}
		>
		  {value} ★ - {descriptions[value]}
		</button>
	      ))}
	    </div>
	  </div>

          <input
            type="date"
            value={rating.date_rated || ''}
            onChange={(e) => handleRatingChange(index, 'date_rated', e.target.value)}
          />
          <textarea
            value={rating.comments || ''}
            onChange={(e) => handleRatingChange(index, 'comments', e.target.value)}
            placeholder="Rating Comments"
          />
	  <div style={{ marginTop: '1rem' }}>
	    <button onClick={() => deleteRating(index)}>Delete Rating</button>
	  </div>
        </div>
      ))}
      <button onClick={addRating}>Add Another Rating</button>

      <div style={{ marginTop: '2em' }}>
        <button onClick={() => navigate(`/restaurant/${dish.restaurant_id}`)}>Close and View Restaurant</button>
        <button onClick={() => navigate(`/restaurant/${dish.restaurant_id}/dish/new?ts=${Date.now()}`)}>Close and Add Dish</button>
        <button onClick={deleteDish}>Delete Dish</button>
      </div>
    </div>
  )
}


