import { Link } from 'react-router-dom'

export default function PageHeader({ title, titleTo, actions }) {
  const titleContent = titleTo ? <Link to={titleTo}>{title}</Link> : title

  return (
    <div className="page-header">
      <Link to="/" className="page-header__home-link" aria-label="Go to main page">
        <img src="/favicon.ico" alt="" className="page-header__icon" />
      </Link>
      <h1 className="page-header__title">{titleContent}</h1>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  )
}
