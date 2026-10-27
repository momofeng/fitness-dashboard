import { db, newId } from '../db';
import { cardioSchema, type Cardio } from '../schemas';
export async function saveCardio(input: Omit<Cardio, 'id' | 'updatedAt'> & { id?: string }) {
  const row = cardioSchema.parse({ ...input, id: input.id ?? newId(), updatedAt: Date.now() });
  if (row.minutes <= 0) throw new Error('分鐘須大於 0');
  await db.cardio.put(row);
  return row;
}
