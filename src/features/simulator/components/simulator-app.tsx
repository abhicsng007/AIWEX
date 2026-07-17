'use client'

// The interactive shell stays client-side because it owns transient workspace
// state. Server components and route handlers can be introduced behind this
// boundary without changing the page contract.
export { default } from '@/App'
