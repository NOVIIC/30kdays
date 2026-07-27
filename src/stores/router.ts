import { writable, derived } from 'svelte/store'

export type View = 'onboarding' | 'grid' | 'settings'
export type Route = { view: View; params: Record<string, string> }

function parseRoute(): Route {
  const hash = window.location.hash.slice(1) || ''
  const [view, ...rest] = hash.split('?')
  const params: Record<string, string> = {}
  if (rest.length > 0) {
    for (const pair of rest.join('?').split('&')) {
      const [k, v] = pair.split('=')
      params[k] = v || ''
    }
  }
  return { view: (view as View) || 'grid', params }
}

export function createRouter() {
  const route = writable<Route>(parseRoute())

  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', () => {
      route.set(parseRoute())
    })
  }

  const view = derived(route, ($route) => $route.view)
  const params = derived(route, ($route) => $route.params)

  function navigate(view: View, params?: Record<string, string>) {
    let hash = view
    if (params && Object.keys(params).length > 0) {
      hash += '?' + new URLSearchParams(params).toString()
    }
    window.location.hash = hash
  }

  return { route, view, params, navigate }
}
