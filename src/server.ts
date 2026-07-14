import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createSchema, createYoga } from 'graphql-yoga'
import { resolvers } from './resolvers.js'

const typeDefs = readFileSync(new URL('./schema.graphql', import.meta.url), 'utf8')

const yoga = createYoga({ schema: createSchema({ typeDefs, resolvers }) })
const port = Number(process.env.PORT ?? 4000)

createServer(yoga).listen(port, () => {
  console.log(`ready at http://localhost:${port}/graphql`)
})
