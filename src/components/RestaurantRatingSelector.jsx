const RATING_DESCRIPTIONS = {
  1: 'Disgusting (threw away)',
  2: "Don't order again",
  3: 'Fine',
  4: 'Pretty Good',
  5: 'Favorite'
}

export default function RestaurantRatingSelector({ value, onChange, calculatedRating }) {
  const selectedRating = value === '' || value == null ? null : Number(value)

  return (
    <fieldset className="restaurant-rating-selector">
      <legend>Restaurant rating override</legend>
      <p>
        Leave this unset to calculate the restaurant rating from its dish ratings.
        {calculatedRating !== undefined && (
          calculatedRating === null
            ? ' There is no calculated rating yet.'
            : <> Calculated rating: <strong>{calculatedRating} ★</strong>.</>
        )}
      </p>
      <div className="restaurant-rating-selector__options">
        {[1, 2, 3, 4, 5].map(rating => (
          <button
            type="button"
            key={rating}
            className={selectedRating === rating ? 'is-selected' : ''}
            aria-pressed={selectedRating === rating}
            onClick={() => onChange(rating)}
          >
            {rating} ★ – {RATING_DESCRIPTIONS[rating]}
          </button>
        ))}
      </div>
      {selectedRating !== null && (
        <button type="button" className="rating-clear-button" onClick={() => onChange('')}>
          Use calculated rating
        </button>
      )}
    </fieldset>
  )
}
