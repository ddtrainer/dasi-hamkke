import type { PetProfile } from '../lib/pet'
import { DogBody, type DogRefs } from './DogModel'
import { CatBody } from './CatModel'

/** The companion's body: a dog or a cat, chosen by the profile. Both use the same refs so the animation code is shared. */
export function PetBody({ pet, outfit, refs }: { pet: PetProfile; outfit: string | null; refs: DogRefs }) {
  if (pet.kind === 'cat') return <CatBody pet={pet} refs={refs} />
  return <DogBody pet={pet} outfit={outfit} refs={refs} />
}
