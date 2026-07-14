import { GraphQLError } from 'graphql'
import { forecastFor } from './forecast.js'
import { UpstreamError } from './openmeteo.js'
import { scoreWeek } from './score.js'

export const resolvers = {
  Query: {
    outlook: async (_parent: unknown, args: { city: string }) => {
      let week
      try {
        week = await forecastFor(args.city)
      } catch (err) {
        if (err instanceof UpstreamError) {
          throw new GraphQLError('weather data is unavailable right now, try again shortly', {
            extensions: { code: 'UPSTREAM_UNAVAILABLE' },
          })
        }
        throw err
      }

      if (!week) {
        throw new GraphQLError(`no place found matching "${args.city}"`, {
          extensions: { code: 'CITY_NOT_FOUND' },
        })
      }

      const { activities, scoredBy } = await scoreWeek(week)
      return {
        place: week.place,
        fetchedAt: week.fetchedAt,
        servedFrom: week.servedFrom === 'store' ? 'STORE' : 'API',
        scoredBy,
        activities,
      }
    },
  },
}
