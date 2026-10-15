import { MongoClient, type ObjectId } from 'mongodb'

export type DocRow = { _id: ObjectId; title: string; markdown: string; updatedAt: Date }

let client: MongoClient | undefined

export async function docs() {
  client ??= new MongoClient(process.env.MONGODB_URI!)
  await client.connect()
  return client.db().collection<DocRow>('docs')
}
