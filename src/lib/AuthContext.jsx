import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/api/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)

  useEffect(() => {
    let mounted = true

    async function init() {
      setIsLoadingAuth(true)
      const { data, error } = await supabase.auth.getSession()
      if (!mounted) return

      if (error) {
        console.error('getSession error:', error)
      }

      setSession(data?.session ?? null)
      setUser(data?.session?.user ?? null)
      setIsLoadingAuth(false)
    }

    init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      setIsLoadingAuth(false)
    })

    return () => {
      mounted = false
      sub?.subscription?.unsubscribe?.()
    }
  }, [])

  const value = useMemo(() => ({
    session,
    user,
    isAuthenticated: !!session,
    isLoadingAuth,
    signInWithPassword: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password) =>
      supabase.auth.signUp({ email, password }),
    logout: () => supabase.auth.signOut(),
    getUser: () => supabase.auth.getUser(),
  }), [session, user, isLoadingAuth])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
