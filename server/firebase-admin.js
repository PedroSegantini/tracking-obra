import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
export function adminServices() {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) throw new Error('Credenciais administrativas do Firebase não configuradas no servidor.')
  const app = getApps()[0] || initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  return { auth: getAuth(app), db: getFirestore(app) }
}
