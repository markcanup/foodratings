import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import './dish-order-linker.css'

const CUSTOMIZATION_NAME_KEYS = [
  'name',
  'customizationName',
  'customization_name',
  'optionName',
  'option_name',
  'selectionName',
  'selection_name',
  'displayName',
  'display_name',
  'itemName',
  'item_name',
  'label',
  'value',
  'title'
]

function directCustomizationName(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return ''

  for (const key of CUSTOMIZATION_NAME_KEYS) {
    const candidate = value[key]
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }

  return ''
}

function customizationComponents(value, path) {
  if (typeof value === 'string' && value.trim()) {
    return [{ path, name: value.trim() }]
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => customizationComponents(entry, [...path, index]))
  }

  if (!value || typeof value !== 'object') return []

  const nestedComponents = Object.entries(value)
    .filter(([key, entry]) => (
      !CUSTOMIZATION_NAME_KEYS.includes(key)
      && entry
      && (Array.isArray(entry) || typeof entry === 'object')
    ))
    .flatMap(([key, entry]) => customizationComponents(entry, [...path, key]))

  if (nestedComponents.length > 0) return nestedComponents

  const name = directCustomizationName(value)
  return name ? [{ path, name }] : []
}

function componentKey(path) {
  return `customization:${path.map(part => encodeURIComponent(String(part))).join('/')}`
}

function componentsForItem(item) {
  const customizations = Array.isArray(item.customizations) ? item.customizations : []
  const extractedCustomizations = customizations.flatMap((customization, index) => {
    const extracted = customizationComponents(customization, [index])
    const components = extracted.length > 0
      ? extracted
      : [{ path: [index], name: `Customization ${index + 1}` }]

    return components.map(component => ({
      key: componentKey(component.path),
      kind: 'customization',
      name: component.name
    }))
  })

  return [
    { key: 'menu-item', kind: 'menu_item', name: item.menuItemName },
    ...extractedCustomizations
  ]
}

function formatOrderedAt(value) {
  if (!value) return 'Unknown date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function groupLinkedComponents(components) {
  const groups = new Map()

  components.forEach(component => {
    const existing = groups.get(component.orderItemId) || {
      orderItemId: component.orderItemId,
      menuItemName: component.menuItemName,
      merchantName: component.merchantName,
      orderedAt: component.orderedAt,
      components: []
    }
    existing.components.push(component)
    groups.set(component.orderItemId, existing)
  })

  return [...groups.values()]
}

export default function DishOrderLinker({ dish, onDishNameChange, onOrderDateSelected }) {
  const [linkedComponents, setLinkedComponents] = useState([])
  const [orderItems, setOrderItems] = useState([])
  const [selectedItemId, setSelectedItemId] = useState('')
  const [selectedComponentKeys, setSelectedComponentKeys] = useState([])
  const [dishNameSource, setDishNameSource] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const menuRef = useRef(null)

  const loadLinkages = useCallback(async () => {
    if (!dish?.id) return
    setLoading(true)
    setError('')

    const { data, error: loadError } = await supabase.rpc('dish_order_linkages', {
      p_dish_id: dish.id
    })

    if (loadError) {
      setError(loadError.message)
    } else {
      setLinkedComponents(data?.linkedComponents || [])
      setOrderItems(data?.availableItems || [])
    }
    setLoading(false)
  }, [dish?.id])

  useEffect(() => {
    loadLinkages()
  }, [loadLinkages])

  useEffect(() => {
    if (!menuOpen) return undefined

    const closeOnOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])

  const visibleOrderItems = useMemo(() => orderItems.filter(item => {
    const associatedKeys = new Set((item.associations || []).map(association => association.componentKey))
    return componentsForItem(item).some(component => !associatedKeys.has(component.key))
  }), [orderItems])

  const selectedItem = visibleOrderItems.find(item => item.id === selectedItemId) || null
  const selectedItemComponents = selectedItem ? componentsForItem(selectedItem) : []
  const selectedItemAssociations = new Map(
    (selectedItem?.associations || []).map(association => [association.componentKey, association])
  )
  const linkedGroups = groupLinkedComponents(linkedComponents)

  useEffect(() => {
    if (selectedItemId && !visibleOrderItems.some(item => item.id === selectedItemId)) {
      setSelectedItemId('')
      setSelectedComponentKeys([])
    }
  }, [selectedItemId, visibleOrderItems])

  const handleItemChange = (itemId) => {
    const item = visibleOrderItems.find(entry => entry.id === itemId)
    const associatedKeys = new Set((item?.associations || []).map(association => association.componentKey))
    const availableKeys = item
      ? componentsForItem(item).filter(component => !associatedKeys.has(component.key)).map(component => component.key)
      : []

    setSelectedItemId(itemId)
    setSelectedComponentKeys(availableKeys)
    setDishNameSource(itemId && !dish.name?.trim() ? 'menu-item-name' : '')
    setMenuOpen(false)
    setError('')
    setNotice('')
  }

  const toggleComponent = (key) => {
    if (selectedComponentKeys.includes(key) && dishNameSource === key) setDishNameSource('')
    setSelectedComponentKeys(current => current.includes(key)
      ? current.filter(componentKey => componentKey !== key)
      : [...current, key])
  }

  const handleAssociate = async () => {
    if (!selectedItem || selectedComponentKeys.length === 0) return
    setBusy(true)
    setError('')
    setNotice('')

    const components = selectedItemComponents.filter(component => selectedComponentKeys.includes(component.key))
    const { error: associateError } = await supabase.rpc('associate_dish_order_components', {
      p_dish_id: dish.id,
      p_external_order_item_id: selectedItem.id,
      p_components: components
    })

    if (associateError) {
      setError(associateError.message)
    } else {
      if (dishNameSource) {
        const selectedName = dishNameSource === 'menu-item-name'
          ? selectedItem.menuItemName
          : components.find(component => component.key === dishNameSource)?.name
        if (selectedName) await onDishNameChange(selectedName)
      }
      if (selectedItem.orderedAt) await onOrderDateSelected(selectedItem.orderedAt)
      await loadLinkages()
      setSelectedItemId('')
      setSelectedComponentKeys([])
      setDishNameSource('')
      setNotice('Menu-item components linked.')
    }
    setBusy(false)
  }

  const handleRemove = async (component) => {
    setBusy(true)
    setError('')
    setNotice('')

    const { error: removeError } = await supabase.rpc('remove_dish_order_component', {
      p_dish_id: dish.id,
      p_external_order_item_id: component.orderItemId,
      p_component_key: component.componentKey
    })

    if (removeError) {
      setError(removeError.message)
    } else {
      await loadLinkages()
      setNotice('Menu-item component removed.')
    }
    setBusy(false)
  }

  return (
    <section className="dish-order-linker">
      <h3>Ordered menu item</h3>
      <p>Link this dish to a menu item, any of its customizations, or both. Link changes are saved immediately.</p>

      {loading && <p className="dish-order-linker__status">Loading ordered menu items…</p>}

      {!loading && linkedGroups.length === 0 && (
        <p className="dish-order-linker__status">This dish is not linked to an ordered item yet.</p>
      )}

      {linkedGroups.map(group => (
        <article className="dish-order-linker__linked" key={group.orderItemId}>
          <div className="dish-order-linker__item-heading">
            <div>
              <strong>{group.menuItemName}</strong>
              <small>{formatOrderedAt(group.orderedAt)} · {group.merchantName}</small>
            </div>
            <button type="button" className="secondary-button" disabled={busy} onClick={() => onDishNameChange(group.menuItemName)}>
              Use menu item name
            </button>
          </div>
          <ul>
            {group.components.map(component => (
              <li key={component.componentKey}>
                <span>
                  <strong>{component.componentName}</strong>
                  <small>{component.componentKind === 'menu_item' ? 'Menu item' : 'Customization'}</small>
                </span>
                <span className="dish-order-linker__component-actions">
                  <button type="button" className="secondary-button" disabled={busy} onClick={() => onDishNameChange(component.componentName)}>
                    Use name
                  </button>
                  <button type="button" className="remove-button" disabled={busy} onClick={() => handleRemove(component)}>
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </article>
      ))}

      {!loading && visibleOrderItems.length === 0 && !error && (
        <p className="dish-order-linker__status">
          No partially or fully unlinked ordered items are available for this restaurant.
        </p>
      )}

      {visibleOrderItems.length > 0 && (
        <div className="dish-order-linker__add">
          <label id="ordered-menu-item-label">Menu item to link</label>
          <div className="dish-order-linker__dropdown" ref={menuRef}>
            <button
              type="button"
              className="dish-order-linker__dropdown-toggle"
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              aria-labelledby="ordered-menu-item-label ordered-menu-item-value"
              disabled={busy}
              onClick={() => setMenuOpen(open => !open)}
            >
              <span id="ordered-menu-item-value">
                {selectedItem
                  ? `${formatOrderedAt(selectedItem.orderedAt)} — ${selectedItem.menuItemName}`
                  : 'Select an ordered menu item…'}
              </span>
              <span aria-hidden="true">▾</span>
            </button>

            {menuOpen && (
              <div className="dish-order-linker__dropdown-menu" role="listbox" aria-labelledby="ordered-menu-item-label">
                {visibleOrderItems.map(item => {
                  const associations = new Map(
                    (item.associations || []).map(association => [association.componentKey, association])
                  )
                  const customizations = componentsForItem(item).filter(component => component.kind === 'customization')

                  return (
                    <button
                      type="button"
                      className="dish-order-linker__dropdown-option"
                      role="option"
                      aria-selected={item.id === selectedItemId}
                      key={item.id}
                      onClick={() => handleItemChange(item.id)}
                    >
                      <span className="dish-order-linker__dropdown-parent">
                        <strong>{item.menuItemName}</strong>
                        <small>{formatOrderedAt(item.orderedAt)}</small>
                      </span>
                      {customizations.length > 0 && (
                        <span className="dish-order-linker__dropdown-customizations">
                          {customizations.map(component => {
                            const association = associations.get(component.key)
                            return (
                              <span key={component.key} className={association ? 'is-linked' : ''}>
                                <span aria-hidden="true">↳</span>
                                <span>
                                  {component.name}
                                  {association && <small>Linked to {association.dishName}</small>}
                                </span>
                              </span>
                            )
                          })}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {selectedItem && (
            <fieldset>
              <legend>Include in this dish</legend>
              {selectedItemComponents.map(component => {
                const association = selectedItemAssociations.get(component.key)
                return (
                  <label key={component.key}>
                    <input
                      type="checkbox"
                      checked={!association && selectedComponentKeys.includes(component.key)}
                      disabled={Boolean(association) || busy}
                      onChange={() => toggleComponent(component.key)}
                    />
                    <span>
                      {component.name}
                      <small>
                        {component.kind === 'menu_item' ? 'Menu item' : 'Customization'}
                        {association ? ` · already linked to ${association.dishName}` : ''}
                      </small>
                    </span>
                  </label>
                )
              })}
            </fieldset>
          )}

          {selectedItem && (
            <label className="dish-order-linker__name-source">
              Dish name after linking
              <select value={dishNameSource} disabled={busy} onChange={(event) => setDishNameSource(event.target.value)}>
                <option value="">Keep the current dish name</option>
                <option value="menu-item-name">{selectedItem.menuItemName} (menu item)</option>
                {selectedItemComponents
                  .filter(component => (
                    component.kind === 'customization'
                    && selectedComponentKeys.includes(component.key)
                  ))
                  .map(component => (
                    <option key={component.key} value={component.key}>{component.name} (customization)</option>
                  ))}
              </select>
            </label>
          )}

          <button type="button" disabled={!selectedItem || selectedComponentKeys.length === 0 || busy} onClick={handleAssociate}>
            {busy ? 'Saving…' : 'Link selected parts'}
          </button>
        </div>
      )}

      {notice && <p className="dish-order-linker__status">{notice}</p>}
      {error && <p className="dish-order-linker__error">{error}</p>}
    </section>
  )
}
