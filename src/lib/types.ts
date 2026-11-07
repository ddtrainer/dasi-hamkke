export type Visibility = 'public' | 'private'
export interface Memorial {
  id: string
  ownerId: string
  petName: string
  species: string
  birthDate: string
  passedDate: string
  message: string
  photoUrl: string | null
  visibility: Visibility
  slot: number
  createdAt: string
}
export interface Tribute {
  id: string
  memorialId: string
  authorId: string
  kind: 'flowers' | 'candle' | 'letter'
  body: string
  createdAt: string
}
export interface NewMemorial {
  petName: string
  species: string
  birthDate: string
  passedDate: string
  message: string
  visibility: Visibility
  photo: Blob | null
}
export interface Api {
  mode: 'local' | 'supabase'
  userId(): Promise<string>
  list(): Promise<Memorial[]>
  create(m: NewMemorial, preferredSlot?: number): Promise<Memorial>
  setVisibility(id: string, v: Visibility): Promise<void>
  remove(id: string): Promise<void>
  tributes(memorialId: string): Promise<Tribute[]>
  flowerCounts(): Promise<Record<string, number>>
  candleCounts(): Promise<Record<string, number>>
  addTribute(memorialId: string, kind: 'flowers' | 'candle' | 'letter', body: string): Promise<Tribute>
}
export const LIMITS = { name: 20, message: 300, letter: 500, photoBytes: 5 * 1024 * 1024 }
