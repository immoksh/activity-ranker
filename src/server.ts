import { createServer } from 'node:http'
import { createSchema, createYoga } from 'graphql-yoga'

const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Query {
      ping: String!
    }
  `,
  resolvers: {
    Query: {
      ping: () => 'pong',
    },
  },
})

const yoga = createYoga({ schema })
const port = Number(process.env.PORT ?? 4000)

createServer(yoga).listen(port, () => {
  console.log(`ready at http://localhost:${port}/graphql`)
})
