import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './styles/globals.css'

// NOTE: Alert / AbortError suppression is set up inline in index.html so it's
// in place before MusicKit JS ever loads. Don't re-do it here.

ReactDOM.createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <App />
  </HashRouter>,
)
