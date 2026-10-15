import { MongoClient, type ObjectId } from 'mongodb'

export type DocRow = { _id: ObjectId; title: string; markdown: string; updatedAt: Date }

let client: MongoClient | undefined

export async function docs() {
  client ??= new MongoClient(process.env.MONGODB_URI!)
  await client.connect()
  return client.db(new URL(process.env.MONGODB_URI!.replace(/^mongodb(\+srv)?:/, 'http:')).pathname.slice(1) || 'dictate').collection<DocRow>('docs')
}
